-- Migration: add storefront_domain to markets
-- Run in Supabase SQL Editor

ALTER TABLE markets ADD COLUMN IF NOT EXISTS storefront_domain text;

UPDATE markets SET storefront_domain = 'mvolo.nl'  WHERE code = 'NL';
UPDATE markets SET storefront_domain = 'mvolo.be'  WHERE code = 'BE';
UPDATE markets SET storefront_domain = 'mvolo.de'  WHERE code = 'DE';
UPDATE markets SET storefront_domain = 'mvolo.eu'  WHERE code = 'FR';
UPDATE markets SET storefront_domain = 'mvolo.de'  WHERE code = 'AT';
UPDATE markets SET storefront_domain = 'mvolo.de'  WHERE code = 'CH';

-- Verify
SELECT code, name, language_code, storefront_domain FROM markets ORDER BY code;
