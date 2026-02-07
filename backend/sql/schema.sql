-- Enable PostGIS (required for geometry)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Buildings table
CREATE TABLE buildings (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT,
  geom GEOMETRY(GEOMETRY, 4326) NOT NULL
);

-- Spatial index for fast queries
CREATE INDEX buildings_geom_gist
ON buildings
USING GIST (geom);