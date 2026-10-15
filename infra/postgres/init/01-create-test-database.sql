-- Runs once, on first initialisation of the local Postgres volume.
-- Integration tests migrate and write to this database, never funfriday_dev.
CREATE DATABASE funfriday_test OWNER funfriday_dev;
