usa la mia cartella locale
./mosquitto/config

come se fosse

/mosquitto/config
dentro il container


per simulare il drone con esp32 che invia i dati in fase di sviluppo uso fake_drone.js e lo uso come client che pubblica sui topic.

influxDB appunti:
https://docs.influxdata.com/influxdb3/core/get-started/setup/
https://docs.influxdata.com/influxdb3/core/admin/tokens/admin/
https://docs.influxdata.com/influxdb3/core/admin/databases/
https://docs.influxdata.com/influxdb3/core/get-started/write/
https://docs.influxdata.com/influxdb3/core/get-started/query/

LLM INUTILE per documentazione 3.0 core troppo moderna la versione

per fare setup:
docker exec -it influx_db bash

influxdb3 create token --admin

una volta eseguito il comando il token è unico e mi servirà per fare tutto, non potrò recuperarlo, il rpimo token generato è l'operatore del server

con il comando --token aggiungo il token alla chimata per autorizzarmi per ogni operazione
influxdb3 show tokens --token

Per rigenerare un token operatore, è necessaria la stringa del token corrente:
influxdb3 create token --admin \
  --regenerate \
  --token OPERATOR_TOKEN

  Token operatore : un token amministrativo generato dal sistema con il nome _admin.

Non può essere modificato o eliminato
mai cresce
Non può essere ricreato in caso di smarrimento (funzionalità futura)
Può essere rigenerato tramite la CLI
Token amministrativo denominato : Token amministrativi definiti dall'utente con autorizzazioni amministrative complete.

Può essere creato, modificato ed eliminato
Date di scadenza del supporto
Impossibile modificare o rimuovere il token dell'operatore
Un'istanza di InfluxDB 3 Core può avere un token operatore e un numero illimitato di token amministratori denominati.


creo database:
influxdb3 create database   --retention-period 30d  droneDB  --token ""

vedo database:
influxdb3 show databases --token

SQL vs InfluxQL
InfluxDB 3 Core supporta due linguaggi di interrogazione: SQL e InfluxQL. Sebbene questi due linguaggi siano simili, presentano importanti differenze da considerare



se non creo database:
InfluxDB 3 Core è progettato per un'elevata velocità di scrittura e utilizza una sintassi di scrittura efficiente e leggibile chiamata protocollo di linea . InfluxDB è un database "schema-on-write", il che significa che è possibile iniziare a scrivere dati e InfluxDB crea automaticamente il database logico, le tabelle e i relativi schemi, senza alcun intervento richiesto. Una volta creato lo schema, InfluxDB convalida le future richieste di scrittura rispetto allo schema prima di accettare nuovi dati. È possibile aggiungere nuovi tag e campi in un secondo momento, man mano che lo schema si modifica.

Esempio pratico
Supponiamo di eseguire questo comando senza aver creato nulla in precedenza:

influxdb3 write \
  --database mydb \
  --token AUTH_TOKEN \
  'home,room=Kitchen temp=21.0,hum=35.9,co=0i 1641024000'
InfluxDB creerà automaticamente:

Database: mydb
Tabella: home (il nome prima della virgola nel line protocol)
Tag column: room (tipo: string dictionary)
Field columns:
temp → float64
hum → float64
co → int64
Colonna time: timestamp in nanosecondi
Il risultato è equivalente ad aver creato manualmente una tabella con questo schema:

influxdb3 create table \
  --tags room \
  --fields temp:float64,hum:float64,co:int64 \
  --database mydb \
  --token AUTH_TOKEN \
  home

se aggiungo in un secondo momento dei nuovi campi verrannoa ggiunti in fondo alla tabella

come li salvo:
const line =
    `gps,device=drone1 lat=44.69,lng=10.63,alt=120`;

| measurement | tag           | fields      | timestamp  |
| ----------- | ------------- | ----------- | ---------- |
| gps         | device=drone1 | lat,lng,alt | automatico |

per evdere tutti i dati del db:

  influxdb3 query \
  --token AUTH_TOKEN \
  --database DATABASE_NAME \
  "SELECT * FROM home ORDER BY time"

sostituisco DATABASE_NAME con il nome del database e home con il nome della tabella (measurement).

per vedere le tabelle disponibili nel db:
influxdb3 query \
  --database DATABASE_NAME \
  --token AUTH_TOKEN \
  "SHOW TABLES"

per documentazione node:
https://www.npmjs.com/package/@influxdata/influxdb3-client?activeTab=readme