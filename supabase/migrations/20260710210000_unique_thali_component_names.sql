-- Prevent duplicate dish/add-on names on the same menu item (case-insensitive).

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY menu_item_id, lower(trim(name))
           ORDER BY sort_order ASC, id ASC
         ) AS rn
  FROM public.thali_components
)
DELETE FROM public.thali_components
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS thali_components_menu_name_uidx
  ON public.thali_components (menu_item_id, lower(trim(name)));
