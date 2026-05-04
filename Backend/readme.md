Avvia il Database:
Nella cartella principale: docker compose up -d

Abilita PostGIS (solo la prima volta):
docker exec -it gis_db psql -U user_admin -d mio_gis_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"

Installa Node Modules:
Entra in backend/ e lancia: npm install

Lancia il Backend:
Sempre in backend/: npm run dev