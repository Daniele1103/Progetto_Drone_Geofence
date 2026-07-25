# Progetto Drone Geofence

Sistema di geofencing per drone ESP32 con telemetria in tempo reale, backend Node.js, dashboard React, PostGIS per il calcolo spaziale e InfluxDB per lo storico dei dati.

## Struttura del progetto

```
Progetto_Drone_Geofence/
├── docker-compose.yml
├── .env                    # da creare, vedi sotto (NON versionato su Git)
├── db/
│   └── init/
│       └── postgis_schema.sql
├── mosquitto/
│   └── config/
│       └── mosquitto.conf
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
├── frontend/
├── firmware/
└── Fake_Drone/    # simulatore drone per test, opzionale
```

## Prerequisiti

- **Docker Desktop** installato e avviato
- **Node.js** (v18+) e **npm**, per far girare il frontend

## 1. Clonazione del progetto

```bash
git clone <url-del-repository>
cd Progetto_Drone_Geofence
```

## 2. Creazione file `.env`

Il file `.env` non è incluso nel repository. Bisogna crearlo nella cartella principale del progetto con questo contenuto, sostituendo i valori dove indicato:

```dotenv
# POSTGRES / POSTGIS
POSTGRES_USER=user_admin
POSTGRES_PASSWORD=scegli_una_password
POSTGRES_DB=mio_gis_db
POSTGRES_PORT=5433

# MQTT (MOSQUITTO)
MQTT_PORT=1883

# INFLUXDB
INFLUX_PORT=8181
INFLUX_NODE_ID=drone-node
INFLUX_TOKEN=          # da generare al passo 3
INFLUX_DB=droneDB

# BACKEND
PORT=3000
```

## 3. Avvio database e generazione token InfluxDB

Prima build completa dei container:

```bash
docker compose up -d --build
```

Al primo avvio:
- **PostGIS** crea automaticamente il database e la tabella `geofences` (schema in `db/init/postgis_schema.sql`) — nessun intervento manuale necessario.
- **InfluxDB 3** invece **non genera un token automaticamente** in modo prevedibile: token e database vanno creati manualmente la prima volta.

Entrare nel container InfluxDB:

```bash
docker exec -it influx_db bash
```

Generare il token admin (il primo token generato è l'**operator token**, chiamato `_admin`, è unico, non recuperabile in seguito, e servirà per ogni operazione successiva):

```bash
influxdb3 create token --admin
```

Si copia la stringa del token restituita.

Creazione del database (con retention di 30 giorni, sostituire `TOKEN` con quello appena generato):

```bash
influxdb3 create database --retention-period 30d droneDB --token "TOKEN"
```

Verificare che sia stato creato correttamente:

```bash
influxdb3 show databases --token "TOKEN"
```

Uscire dal container:

```bash
exit
```

Incollare il token nel file `.env` creato poco fa:

```dotenv
INFLUX_TOKEN=apiv3_xxxxxxxxxxxxxxxxxxxxxxxx
```

Riavvio backend perché legga il nuovo token:

```bash
docker compose up -d --build backend
```

**Nota**: InfluxDB 3 è "schema-on-write" — non serve creare tabelle/misurazioni in anticipo, vengono generate automaticamente al primo dato scritto (es. dal backend che pubblica GPS/temperatura/umidità). Creare il database esplicitamente con `create database` serve solo per poter impostare fin da subito parametri come la retention.

## 4. Verificare che tutto sia partito correttamente

```bash
docker ps
```

Ci dovrebbero essere quattro container in stato "Up": `gis_db`, `mqtt_broker`, `influx_db`, `backend_gis`.

Controllo dei log del backend:

```bash
docker logs backend_gis
```

Si dovrebbe vedere, senza errori:
- `WebSocket server avviato su ws://localhost:3001`
- `Server running on port 3000`
- `Connesso a Mosquitto: mqtt://mosquitto:1883`
- `Connesso a PostGIS`
- `Connesso a InfluxDB (versione 3.9.2)`
- `status:  false` (normale: il drone non è ancora online, non è un errore)
- le righe `Subscribed a: drone/...` per ciascun topic MQTT (gps, temp, hum, battery, status, gps_status, commands)

Verifica della creazione della tabella in PostGIS:

```bash
docker exec -it gis_db psql -U user_admin -d mio_gis_db -c "\dt"
```

Ci dovrebbe essere `geofences` nell'elenco.

## 5. Avvio frontend

```bash
cd frontend
npm install
npm run dev
```

Apertura del browser sull'URL mostrato in console da Vite (di norma `http://localhost:5173`).

## 6. (Opzionale) Testing del sistema senza un drone reale

Nella cartella `Fake_Drone/`:

```bash
cd Fake_Drone
npm install
node server.js
```

Apertura `index.html` nel browser. La dashboard dovrebbe mostrare il drone muoversi in tempo reale.

## Comandi utili

| Azione | Comando |
|---|---|
| Avviare tutto | `docker compose up -d` |
| Fermare tutto (senza cancellare dati) | `docker compose stop` |
| Fermare e rimuovere i container (dati intatti) | `docker compose down` |
| Fermare e cancellare **anche i dati** | `docker compose down -v` |
| Ricostruire il backend dopo una modifica al codice | `docker compose up -d --build backend` |
| Vedere i log di un servizio | `docker logs -f <nome_container>` |
| Entrare nel database Postgres | `docker exec -it gis_db psql -U <utente> -d <database>` |

## Comandi InfluxDB utili per il debug

Da dentro il container (`docker exec -it influx_db bash`):

```bash
# elenca le tabelle (measurement) presenti nel database
influxdb3 query --database droneDB --token "TOKEN" "SHOW TABLES"

# vede gli ultimi dati GPS scritti
influxdb3 query --database droneDB --token "TOKEN" "SELECT * FROM gps ORDER BY time LIMIT 10"

# elenca i token esistenti
influxdb3 show tokens --token "TOKEN"

# elimina una tabella (measurement)
influxdb3 delete table --database droneDB --token "TOKEN" NOME_TABELLA
```

## Firmware: build e flash

Per aggiornare il firmware sul drone:

1. Entrare nella cartella del firmware (ESP-Drone)
2. Buildare il progetto
3. Collegare il drone via USB (porta seriale, es. COM4)
4. Flashare il firmware sull'ESP32-S2

### Configurazione da modificare prima del flash

**Wi-Fi (interfaccia station):**
Nel file di configurazione della rete bisogna sostituire SSID e password con quelli della propria rete locale (l'hotspot/rete dove è in esecuzione il broker Mosquitto), altrimenti il drone non riesce a ottenere un IP sull'interfaccia station e la connessione MQTT non parte mai.

**MQTT (broker):**
Nel file di configurazione MQTT bisogna sostituire l'IP (e porta, se diversa dal default) del broker Mosquitto con quello della macchina/rete su cui sta girando il container, coerente con la rete Wi-Fi impostata sopra.
