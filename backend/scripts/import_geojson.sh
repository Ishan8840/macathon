#!/bin/bash
set -euo pipefail

set -a
source ./backend/.env
set +a

: "${SUPABASE_DB_HOST:?Missing SUPABASE_DB_HOST}"
: "${SUPABASE_DB_PASS:?Missing SUPABASE_DB_PASS}"

DB_PORT="${SUPABASE_DB_PORT:-5432}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
DB_USER="${SUPABASE_DB_USER:-postgres}"

ogr2ogr -f "PostgreSQL" \
  PG:"host=${SUPABASE_DB_HOST} port=${DB_PORT} dbname=${DB_NAME} user=${DB_USER} password=${SUPABASE_DB_PASS} sslmode=require" \
  data/raw/buildings.geojson \
  -nln buildings \
  -lco GEOMETRY_NAME=geom \
  -t_srs EPSG:4326