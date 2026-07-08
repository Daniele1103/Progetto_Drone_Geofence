#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "driver/uart.h"
#include "driver/gpio.h"

#include "esp_log.h"
#include "esp_err.h"

#include "dht.h"
#include "minmea.h"


static const char *TAG = "TELEMETRY";


// GPS UART

#define GPS_UART_PORT UART_NUM_1

#define GPS_RX_PIN GPIO_NUM_38
#define GPS_TX_PIN GPIO_NUM_39

#define GPS_BAUDRATE 115200

#define GPS_BUF_SIZE 1024


// DHT AM2302

#define DHT_PIN GPIO_NUM_1

// Buffer NMEA

static char nmea_sentence[128];
static int nmea_index = 0;


// ultimo punto stampato
static TickType_t last_gps_print = 0;

// Parsing GPS

static void parse_gps_sentence(char *sentence)
{

    switch(minmea_sentence_id(sentence, false))
    {

        case MINMEA_SENTENCE_GGA:
        {

            struct minmea_sentence_gga frame;


            if(minmea_parse_gga(&frame, sentence))
            {


                // stampa massimo una volta al secondo

                if(xTaskGetTickCount() - last_gps_print >= pdMS_TO_TICKS(1000))
                {

                    last_gps_print = xTaskGetTickCount();



                    float latitude =
                        minmea_tocoord(
                            &frame.latitude
                        );


                    float longitude =
                        minmea_tocoord(
                            &frame.longitude
                        );


                    float altitude =
                        minmea_tofloat(
                            &frame.altitude
                        );


                    float hdop =
                        minmea_tofloat(
                            &frame.hdop
                        );



                    if(frame.fix_quality == 0)
                    {

                        ESP_LOGW(TAG,
                            "GPS NO FIX "
                            "LAT %.6f "
                            "LON %.6f "
                            "ALT %.2f m "
                            "SAT %d "
                            "HDOP %.2f",

                            latitude,
                            longitude,
                            altitude,
                            frame.satellites_tracked,
                            hdop
                        );

                    }
                    else
                    {

                        ESP_LOGI(TAG,
                            "GPS FIX "
                            "LAT %.6f "
                            "LON %.6f "
                            "ALT %.2f m "
                            "SAT %d "
                            "HDOP %.2f",

                            latitude,
                            longitude,
                            altitude,
                            frame.satellites_tracked,
                            hdop
                        );

                    }

                }

            }

            break;
        }


        case MINMEA_SENTENCE_RMC:
        {
            // ignorato
            break;
        }


        default:
            break;
    }
}

// TASK TELEMETRIA

void telemetry_sensors_task(void *pvParameters)
{


    ESP_LOGI(TAG,
        "Avvio Telemetry Task");

    // CONFIG UART GPS

    uart_config_t uart_config =
    {
        .baud_rate =
            GPS_BAUDRATE,

        .data_bits =
            UART_DATA_8_BITS,

        .parity =
            UART_PARITY_DISABLE,

        .stop_bits =
            UART_STOP_BITS_1,

        .flow_ctrl =
            UART_HW_FLOWCTRL_DISABLE,

        .source_clk =
            UART_SCLK_APB
    };



    ESP_ERROR_CHECK(
        uart_param_config(
            GPS_UART_PORT,
            &uart_config
        )
    );



    ESP_ERROR_CHECK(
        uart_set_pin(
            GPS_UART_PORT,

            GPS_TX_PIN,
            GPS_RX_PIN,

            UART_PIN_NO_CHANGE,
            UART_PIN_NO_CHANGE
        )
    );



    ESP_ERROR_CHECK(
        uart_driver_install(
            GPS_UART_PORT,

            GPS_BUF_SIZE * 2,

            0,

            0,

            NULL,

            0
        )
    );



    uint8_t gps_buffer[GPS_BUF_SIZE];



    float temperature = 0;
    float humidity = 0;



    TickType_t last_dht = 0;



    while(1)
    {



        // LETTURA GPS

        int len =
            uart_read_bytes(
                GPS_UART_PORT,

                gps_buffer,

                GPS_BUF_SIZE,

                pdMS_TO_TICKS(20)
            );



        for(int i=0;i<len;i++)
        {


            char c =
                gps_buffer[i];

            // inizio frase

            if(c=='$')
            {

                nmea_index = 0;

                nmea_sentence[nmea_index++] = c;

            }


            else if(nmea_index > 0)
            {


                if(c=='\n')
                {

                    nmea_sentence[nmea_index] = '\0';


                    parse_gps_sentence(
                        nmea_sentence
                    );


                    nmea_index = 0;

                }


                else
                {


                    if(
                        nmea_index <
                        sizeof(nmea_sentence)-1
                    )
                    {

                        nmea_sentence[nmea_index++] = c;

                    }

                }

            }

        }

        // DHT ogni 2 secondi

        if(
            xTaskGetTickCount()
            -
            last_dht
            >=
            pdMS_TO_TICKS(2000)
        )
        {


            last_dht =
                xTaskGetTickCount();



            esp_err_t ret =
                dht_read_float_data(
                    DHT_TYPE_AM2301,

                    DHT_PIN,

                    &humidity,

                    &temperature
                );



            if(ret == ESP_OK)
            {

                ESP_LOGI(TAG,

                    "AM2302 "
                    "TEMP %.1f C "
                    "HUM %.1f %%",

                    temperature,
                    humidity
                );

            }

            else
            {

                ESP_LOGE(TAG,

                    "Errore DHT: %s",

                    esp_err_to_name(ret)
                );

            }

        }



        vTaskDelay(
            pdMS_TO_TICKS(20)
        );

    }

}