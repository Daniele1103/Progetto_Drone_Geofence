#include <stdio.h>
#include <string.h>

#include "esp_log.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "mqtt_client.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "MQTT";

// IP del PC sull'hotspot + porta reale
#define MQTT_BROKER_URI   "mqtt://192.168.137.1:1883"

static esp_mqtt_client_handle_t mqtt_client = NULL;
static volatile bool mqtt_connected = false;

static void mqtt_publish_status(bool online);   // forward declaration

static bool sta_has_ip(void)
{
    esp_netif_t *sta_netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    if (sta_netif == NULL)
    {
        return false;
    }

    esp_netif_ip_info_t ip_info;
    if (esp_netif_get_ip_info(sta_netif, &ip_info) != ESP_OK)
    {
        return false;
    }

    return ip_info.ip.addr != 0;
}

static const char *mqtt_error_type_str(esp_mqtt_error_type_t t)
{
    switch (t)
    {
    case MQTT_ERROR_TYPE_TCP_TRANSPORT: return "TCP_TRANSPORT";
    case MQTT_ERROR_TYPE_CONNECTION_REFUSED: return "CONNECTION_REFUSED";
    default: return "NONE/SCONOSCIUTO";
    }
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base,
                                int32_t event_id, void *event_data)
{
    switch (event_id)
    {
    case MQTT_EVENT_BEFORE_CONNECT:
        ESP_LOGI(TAG, "[MQTT] tentativo di connessione al broker...");
        break;

    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "[MQTT] CONNESSO al broker");
        mqtt_connected = true;
        mqtt_publish_status(true);
        break;

    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "[MQTT] disconnesso dal broker");
        mqtt_connected = false;
        break;

    case MQTT_EVENT_PUBLISHED:
        ESP_LOGD(TAG, "[MQTT] messaggio confermato dal broker, msg_id=%d", event_id);
        break;

    case MQTT_EVENT_ERROR:
    {
        esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t) event_data;
        ESP_LOGE(TAG, "[MQTT] ERRORE - tipo=%s", mqtt_error_type_str(event->error_handle->error_type));
        if (event->error_handle->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT)
        {
            ESP_LOGE(TAG, "[MQTT] dettaglio trasporto TCP: esp_tls_err=0x%x, tls_stack_err=0x%x, sock_errno=%d",
                     event->error_handle->esp_tls_last_esp_err,
                     event->error_handle->esp_tls_stack_err,
                     event->error_handle->esp_transport_sock_errno);
        }
        break;
    }

    default:
        break;  
    }
}

static void mqtt_app_start(void)
{

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER_URI,
        .session.last_will.topic = "drone/status",
        .session.last_will.msg = "{\"online\":false}",
        .session.last_will.msg_len = 0,
        .session.last_will.qos = 1,
        .session.last_will.retain = 1,
    };

    ESP_LOGI(TAG, "[MQTT] avvio client verso %s", MQTT_BROKER_URI);

    mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    if (mqtt_client == NULL)
    {
        ESP_LOGE(TAG, "[MQTT] esp_mqtt_client_init fallita (NULL)");
        return;
    }

    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_mqtt_client_start(mqtt_client);
}


static void mqtt_init_task(void *pvParameters)
{
    ESP_LOGI(TAG, "[WIFI] in attesa che la STA ottenga un IP...");

    while (!sta_has_ip())
    {
        vTaskDelay(pdMS_TO_TICKS(200));
    }

    ESP_LOGI(TAG, "[WIFI] IP ottenuto, avvio il client MQTT");

    mqtt_app_start();

    vTaskDelete(NULL);
}


void network_mqtt_init(void)
{
    xTaskCreate(mqtt_init_task, "MqttInitTask", 4096, NULL, 1, NULL);
}


void mqtt_publish_gps(float lat, float lng, float alt, int satellites, float hdop)
{
    if (!mqtt_connected)
    {
        ESP_LOGD(TAG, "[GPS] MQTT non connesso, pubblicazione saltata");
        return;
    }

    char payload[128];
    snprintf(payload, sizeof(payload),
             "{\"lat\":%.6f,\"lng\":%.6f,\"alt\":%.2f,\"sat\":%d,\"hdop\":%.2f}",
             lat, lng, alt, satellites, hdop);

    int msg_id = esp_mqtt_client_publish(mqtt_client, "drone/gps", payload, 0, 1, 0);
    if (msg_id < 0)
    {
        ESP_LOGE(TAG, "[GPS] publish FALLITO su drone/gps");
    }
    else
    {
        ESP_LOGI(TAG, "[GPS] -> drone/gps  %s", payload);
    }
}


void mqtt_publish_temperature(float temperature, float lat, float lng, float alt)
{
    if (!mqtt_connected)
    {
        ESP_LOGD(TAG, "[DHT] MQTT non connesso, pubblicazione temperatura saltata");
        return;
    }

    char payload[128];
    snprintf(payload, sizeof(payload),
             "{\"value\":%.1f,\"lat\":%.6f,\"lng\":%.6f,\"alt\":%.2f}",
             temperature, lat, lng, alt);

    int msg_id = esp_mqtt_client_publish(mqtt_client, "drone/temp", payload, 0, 1, 0);
    if (msg_id < 0)
    {
        ESP_LOGE(TAG, "[DHT] publish FALLITO su drone/temp");
    }
    else
    {
        ESP_LOGI(TAG, "[DHT] -> drone/temp  %s", payload);
    }
}


void mqtt_publish_humidity(float humidity, float lat, float lng, float alt)
{
    if (!mqtt_connected)
    {
        ESP_LOGD(TAG, "[DHT] MQTT non connesso, pubblicazione umidita' saltata");
        return;
    }

    char payload[128];
    snprintf(payload, sizeof(payload),
             "{\"value\":%.1f,\"lat\":%.6f,\"lng\":%.6f,\"alt\":%.2f}",
             humidity, lat, lng, alt);

    int msg_id = esp_mqtt_client_publish(mqtt_client, "drone/hum", payload, 0, 1, 0);
    if (msg_id < 0)
    {
        ESP_LOGE(TAG, "[DHT] publish FALLITO su drone/hum");
    }
    else
    {
        ESP_LOGI(TAG, "[DHT] -> drone/hum  %s", payload);
    }
}


void mqtt_publish_battery(float battery_value)
{
    if (!mqtt_connected)
    {
        ESP_LOGD(TAG, "[BATT] MQTT non connesso, pubblicazione saltata");
        return;
    }

    char payload[32];
    snprintf(payload, sizeof(payload), "{\"value\":%.2f}", battery_value);

    int msg_id = esp_mqtt_client_publish(mqtt_client, "drone/battery", payload, 0, 1, 0);
    if (msg_id < 0)
    {
        ESP_LOGE(TAG, "[BATT] publish FALLITO su drone/battery");
    }
    else
    {
        ESP_LOGI(TAG, "[BATT] -> drone/battery  %s", payload);
    }
}


static void mqtt_publish_status(bool online)
{
    if (!mqtt_connected && online)
    {
        return;
    }

    char payload[32];
    snprintf(payload, sizeof(payload), "{\"online\":%s}", online ? "true" : "false");

    int msg_id = esp_mqtt_client_publish(mqtt_client, "drone/status", payload, 0, 1, 1);
    ESP_LOGI(TAG, "[STATUS] -> drone/status  %s  (msg_id=%d)", payload, msg_id);
}