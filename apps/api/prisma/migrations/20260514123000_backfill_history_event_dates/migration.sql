UPDATE "ClubHistory"
SET "eventDate" = CASE
  WHEN "dateLabel" ~ '^[0-9]{4}\.[0-9]{2}$' THEN to_date("dateLabel" || '.01', 'YYYY.MM.DD')
  WHEN "dateLabel" ~ '^[0-9]{4}$' THEN to_date("dateLabel" || '.01.01', 'YYYY.MM.DD')
  ELSE "eventDate"
END;
