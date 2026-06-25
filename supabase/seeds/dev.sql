-- ACE Wingo V1 — Migration 009
-- Dev-Seed fuer Wingo: Default-TOV, 5G-Disclaimer, ein Sample-Produkt.
-- Idempotent via ON CONFLICT, sicher fuer Re-Run.

DO $$
DECLARE
  v_wingo_id UUID;
BEGIN
  SELECT id INTO v_wingo_id FROM brands WHERE slug = 'wingo' LIMIT 1;
  IF v_wingo_id IS NULL THEN
    RAISE EXCEPTION 'Wingo brand not seeded — Migration 001 fehlt';
  END IF;

  -- Default-TOV (Pflicht damit findVoiceVariant einen Fallback hat)
  INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
    VALUES (
      v_wingo_id, NULL, NULL,
      '# Wingo Default Voice' || chr(10) ||
      chr(10) ||
      '- Direkt, klar, schweizerisch.' || chr(10) ||
      '- Du-Form, kein Kompliziertes.' || chr(10) ||
      '- Preisvorteil zuerst, dann Produktwert.' || chr(10) ||
      '- Kein Telco-Jargon.',
      true
    )
  ON CONFLICT DO NOTHING;

  -- Standard-Kampagnen (V1.1): markengerechter NEUTRALER Ton pro Zielgruppe.
  -- Bewusst KEIN Flash-Dringlichkeitston — Produktwert statt Preisdruck. So
  -- faellt eine Standard-Kampagne nicht still auf den preis-getriebenen Default
  -- zurueck. Die visuelle De-Akzentuierung des Preises macht der Renderer
  -- (emphasis='neutral'); hier nur der Copy-Ton.
  INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
    VALUES
      (v_wingo_id, 'standard', 'sozial',
        '# Wingo Standard — Sozial' || chr(10) || chr(10) ||
        '- Nahbar, frisch, Du-Form.' || chr(10) ||
        '- Produktnutzen zuerst, kein Zeitdruck, keine Dringlichkeit.' || chr(10) ||
        '- Schweizer Netz als Vertrauensanker.' || chr(10) ||
        '- Kein Telco-Jargon.',
        false),
      (v_wingo_id, 'standard', 'rational',
        '# Wingo Standard — Rational' || chr(10) || chr(10) ||
        '- Sachlich, klar, vertrauenswuerdig, Du-Form.' || chr(10) ||
        '- Fakten und Produktwert vor Preis; kein Countdown, keine Dringlichkeit.' || chr(10) ||
        '- Schweizer Netz und Verlaesslichkeit betonen.' || chr(10) ||
        '- Kein Telco-Jargon.',
        false),
      (v_wingo_id, 'standard', 'nativ',
        '# Wingo Standard — Nativ' || chr(10) || chr(10) ||
        '- Redaktionell, ruhig erzaehlend, Du-Form.' || chr(10) ||
        '- Mehrwert und Kontext statt Aktionsdruck; keine Dringlichkeit.' || chr(10) ||
        '- Schweizer Netz beilaeufig als Qualitaetszeichen.' || chr(10) ||
        '- Kein Telco-Jargon.',
        false)
  ON CONFLICT DO NOTHING;

  -- 5G-Swisscom-Netz Disclaimer (Pflicht bei 5G-Mobile-Produkten)
  INSERT INTO disclaimers
    (brand_id, slug, name, conditions_json, applies_to_categories,
     text_de, text_fr, text_it, text_en, is_required)
    VALUES (
      v_wingo_id, '5g_swisscom_netz', '5G im Swisscom Netz',
      '{"network": "5g"}'::jsonb, ARRAY['mobile'],
      '5G im Swisscom Netz',
      '5G dans le reseau Swisscom',
      'Rete 5G di Swisscom',
      '5G in Swisscom network',
      true
    )
  ON CONFLICT (brand_id, slug) DO NOTHING;

  -- Generischer Aktions-/Preis-Disclaimer (Pflicht auf JEDER Kampagne).
  -- conditions {} + leere applies_to_categories => matched JEDES Produkt (alle
  -- Kategorien, alle Netze). Das ist der eigentliche Legal-Line-Text (Mindest-
  -- vertragslaufzeit / Preise inkl. MwSt.), der auf jedem Render erscheinen muss
  -- — vorher fehlte er, sodass nur "5G im Swisscom Netz" auf den Assets stand.
  INSERT INTO disclaimers
    (brand_id, slug, name, conditions_json, applies_to_categories,
     text_de, text_fr, text_it, text_en, is_required)
    VALUES (
      v_wingo_id, 'aktion_preis_standard', 'Aktions-/Preis-Disclaimer (Standard)',
      '{}'::jsonb, ARRAY[]::text[],
      'Aktion zeitlich begrenzt. Mindestvertragslaufzeit 24 Monate. Preise in CHF inkl. MwSt. Es gelten die AGB von Wingo.',
      'Offre limitee dans le temps. Duree minimale du contrat 24 mois. Prix en CHF, TVA incluse. Les CG de Wingo s''appliquent.',
      'Offerta a tempo limitato. Durata minima del contratto 24 mesi. Prezzi in CHF, IVA inclusa. Si applicano le CG di Wingo.',
      'Offer for a limited time only. Minimum contract term 24 months. Prices in CHF incl. VAT. Wingo''s GTC apply.',
      true
    )
  ON CONFLICT (brand_id, slug) DO NOTHING;

  -- Sample-Produkt fuer Tracer-Bullet-Demo
  INSERT INTO products (brand_id, name, category, price_promo, price_standard, price_suffix, link, features, sku, network)
    VALUES (
      v_wingo_id, 'Wingo Mobile Swiss', 'mobile', 19.95, 29.95, '/Mt.',
      'https://wingo.ch/de/mobile-abos/wingo-mobile-swiss',
      ARRAY['Unlimitiert telefonieren', '5G im Swisscom Netz', '30 GB Daten'],
      'WMS-2026', '5g_swisscom'
    );
END $$;
