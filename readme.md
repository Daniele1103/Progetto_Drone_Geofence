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
└── Fake_Drone_Commands/    # simulatore drone per test, opzionale
```

## Prerequisiti

- **Docker Desktop** installato e avviato
- **Node.js** (v18+) e **npm**, per far girare il frontend (e il simulatore, se lo usi)

## 1. Clona il progetto

```bash
git clone <url-del-repository>
cd Progetto_Drone_Geofence
```

## 2. Crea il file `.env`

Il file `.env` non è incluso nel repository (contiene credenziali). Crealo nella cartella principale del progetto con questo contenuto, sostituendo i valori dove indicato:

```dotenv
# --- POSTGRES / POSTGIS ---
POSTGRES_USER=user_admin
POSTGRES_PASSWORD=scegli_una_password
POSTGRES_DB=mio_gis_db
POSTGRES_PORT=5433

# --- MQTT (MOSQUITTO) ---
MQTT_PORT=1883

# --- INFLUXDB ---
INFLUX_PORT=8181
INFLUX_NODE_ID=drone-node
INFLUX_TOKEN=          # da generare al passo 3, lascia vuoto per ora
INFLUX_DB=droneDB

# --- BACKEND ---
PORT=3000
```

## 3. Avvia i database e genera il token InfluxDB

Prima build completa dei container:

```bash
docker compose up -d --build
```

Al primo avvio:
- **PostGIS** crea automaticamente il database e la tabella `geofences` (schema in `db/init/postgis_schema.sql`) — nessun intervento manuale necessario.
- **InfluxDB 3** invece **non genera un token automaticamente** in modo prevedibile: token e database vanno creati manualmente la prima volta.

Entra nel container InfluxDB:

```bash
docker exec -it influx_db bash
```

Genera il token admin (il primo token generato è l'**operator token**, chiamato `_admin` — è unico, non recuperabile in seguito, e ti servirà per ogni operazione successiva):

```bash
influxdb3 create token --admin
```

Copia la stringa del token restituita (inizia con `apiv3_...`).

Crea il database (con retention di 30 giorni, sostituisci `TOKEN` con quello appena generato):

```bash
influxdb3 create database --retention-period 30d droneDB --token "TOKEN"
```

Verifica che sia stato creato correttamente:

```bash
influxdb3 show databases --token "TOKEN"
```

Esci dal container:

```bash
exit
```

Incolla il token nel tuo `.env`:

```dotenv
INFLUX_TOKEN=apiv3_xxxxxxxxxxxxxxxxxxxxxxxx
```

Riavvia il backend perché legga il nuovo token:

```bash
docker compose up -d --build backend
```

**Nota**: InfluxDB 3 è "schema-on-write" — non serve creare tabelle/misurazioni in anticipo, vengono generate automaticamente al primo dato scritto (es. dal backend che pubblica GPS/temperatura/umidità). Creare il database esplicitamente con `create database` serve solo per poter impostare fin da subito parametri come la retention.

## 4. Verifica che tutto sia partito correttamente

```bash
docker ps
```

Dovresti vedere quattro container in stato "Up": `gis_db`, `mqtt_broker`, `influx_db`, `backend_gis`.

Controlla i log del backend:

```bash
docker logs backend_gis
```

Dovresti vedere, senza errori:
- `WebSocket server avviato su ws://localhost:3001`
- `Server running on port 3000`
- `Connesso a Mosquitto: mqtt://mosquitto:1883`
- `Connesso a PostGIS`
- `status:  false` (normale: il drone non è ancora online, non è un errore)
- le righe `Subscribed a: drone/...` per ciascun topic MQTT (gps, temp, hum, battery, status, gps_status, commands)

Verifica la tabella PostGIS:

```bash
docker exec -it gis_db psql -U user_admin -d mio_gis_db -c "\dt"
```

Dovresti vedere `geofences` nell'elenco.

## 5. Avvia il frontend

```bash
cd frontend
npm install
npm run dev
```

Apri il browser sull'URL mostrato in console da Vite (di norma `http://localhost:5173`).

## 6. (Opzionale) Testa il sistema senza un drone reale

Nella cartella `Fake_Drone_Commands/`:

```bash
cd Fake_Drone_Commands
npm install
node server.js
```

Apri `index.html` nel browser, clicca "Connetti", e usa il joystick per simulare i comandi — la dashboard dovrebbe mostrare il drone muoversi in tempo reale.

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


