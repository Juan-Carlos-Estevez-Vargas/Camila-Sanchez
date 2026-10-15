-- =============================================================================
-- Contenido inicial migrado desde la página original (legacy/).
-- Se ejecuta una sola vez después de las migraciones (el flujo Deploy lo hace
-- solo). Todo se edita luego desde los paneles: no cambies este archivo después
-- del primer despliegue, porque si cambia la CLI lo vuelve a ejecutar.
-- =============================================================================

update public.site_settings set
  site_title         = 'Para el amor de mi vida 💖',
  site_subtitle      = 'Esta página es un reflejo de lo mucho que te amo. Cada detalle está hecho para ti.',
  relationship_start = '2025-05-31',
  is_public          = false,
  -- Paleta "Rosa suave" de la versión 1; Camila puede cambiarla desde su panel.
  theme = '{
    "primary": "#c2185b",
    "primaryContrast": "#ffffff",
    "accent": "#ff4081",
    "background": "#ffe6ec",
    "surface": "#fff7f9",
    "text": "#880e4f",
    "muted": "#ad1457",
    "fontDisplay": "Fraunces",
    "fontBody": "Inter",
    "radius": 18,
    "darkMode": "light"
  }'::jsonb,
  effects = '{
    "floating": { "enabled": true, "emojis": ["❤️", "💖", "🌸", "🌷", "✨"], "density": 14 },
    "cursorHearts": false,
    "reduceOnMobile": true
  }'::jsonb
where id = 1;

insert into public.sections (kind, title, subtitle, content, animation, position) values
  ('hero', 'Para el amor de mi vida 💖',
   'Esta página es un reflejo de lo mucho que te amo. Cada detalle está hecho para ti.',
   '{}', 'fade-up', 0),
  ('together_counter', 'Tiempo juntos', 'Y contando, cada segundo a tu lado', '{}', 'zoom-in', 1),
  ('countdowns', 'Fechas que esperamos', 'Lo que falta para nuestros días especiales', '{}', 'fade-up', 2),
  ('love_notes', 'Mensajes del corazón', '', '{
    "cards": [
      { "icon": "☀️", "title": "Cuando pienso en ti...", "body": "Mi día se ilumina solo con recordar tu sonrisa. Eres mi razón para sonreír cada mañana." },
      { "icon": "💗", "title": "Lo que más amo de ti", "body": "Tu forma de ver la vida, tu bondad, y cómo haces que todo sea mejor con tu presencia." },
      { "icon": "🤞", "title": "Promesas", "body": "Prometo estar a tu lado en cada paso, celebrar tus logros y secar tus lágrimas." }
    ]
  }', 'fade-up', 3),
  ('milestones', 'Nuestra historia', 'Los momentos que nos hicieron nosotros', '{}', 'slide-left', 4),
  ('gallery', 'Nuestra historia en fotos', 'Elige un año y un mes para revivir nuestros recuerdos', '{}', 'fade-up', 5),
  ('letter', 'Mi carta para ti', '', '{
    "greeting": "Mi amor...",
    "paragraphs": [
      "Quiero recordarte que eres el mejor regalo que la vida me ha dado. Cada día a tu lado es una bendición y quiero renovar mis promesas de amor eterno."
    ],
    "wishes": [
      "❤️ Que cada Navidad la pasemos juntos",
      "✨ Que nuestros sueños se hagan realidad",
      "🎁 Que nuestro amor siga creciendo",
      "🌟 Que creemos tradiciones juntos"
    ],
    "signature": "Con todo mi amor, tu novio",
    "surprise": {
      "button": "Abrir regalo sorpresa",
      "title": "¡Sorpresa!",
      "text": "Mi regalo más grande para ti es mi amor eterno. Prometo amarte, cuidarte y hacerte feliz cada día de mi vida."
    }
  }', 'zoom-in', 6);

insert into public.milestones (title, description, happened_on, icon, position) values
  ('Primera cita', 'Recuerdo cada detalle de ese día. Cómo me hacías reír, cómo brillaban tus ojos. Desde entonces, supe que cada momento contigo sería especial.', '2025-05-10', '🌟', 0),
  ('El día que te pedí ser mi novia', 'Con mucho nerviosismo, te pedí poder compartir una vida contigo.', '2025-05-30', '💍', 1),
  ('Primer beso', 'Tuve miedo, nervios, y una emoción que no puedo describir. Pero cuando tus labios tocaron los míos, todo cobró sentido.', '2025-05-31', '💋', 2),
  ('Tus primeras flores', 'Cómo olvidar la emoción que sentía al esperar tu reacción.', '2025-06-09', '💐', 3),
  ('Nuestro primer viaje', 'Caminar de tu mano por calles nuevas, descubrir sabores, paisajes y miradas. Fue un nuevo inicio para nosotros.', '2025-06-28', '🏙️', 4),
  ('Todo lo que nos falta por explorar', 'Apenas estamos empezando. Nos esperan ciudades, sueños, retos, abrazos y atardeceres.', '2026-12-31', '🌈', 5);

insert into public.important_dates (title, event_date, recurs_yearly, icon, message, is_visible) values
  ('Nuestro aniversario', '2025-05-31', true, '💞', 'Un año más eligiéndonos', true),
  ('Navidad juntos', '2025-12-24', true, '🎄', 'Que cada Navidad la pasemos juntos', true),
  -- Ajusta la fecha real desde el panel y hazla visible.
  ('Tu cumpleaños', '2025-01-01', true, '🎂', 'El día en que el mundo se volvió más bonito', false);

-- Fotos de la versión original, servidas como archivos estáticos.
insert into public.photos (external_url, caption, taken_on, position) values
  ('/assets/img/2025/mayo1.jpeg', 'Aquí, aún no éramos novios pero el verte trabajar me alegraba mucho el alma', '2025-05-10', 0),
  ('/assets/img/2025/mayo2.jpeg', 'Cómo olvidar el día en que con mucho nerviosismo, te pedí poder compartir una vida contigo y ser novios', '2025-05-30', 1),
  ('/assets/img/2025/junio1.jpeg', 'Tus primeras flores, cómo olvidar la emoción que sentía al esperar tu reacción', '2025-06-09', 0),
  ('/assets/img/2025/junio2.jpeg', 'Mi primer fondo de pantalla alusivo a tí', '2025-06-10', 1),
  ('/assets/img/2025/junio3.jpeg', 'Lo hermosa que te ves enamorada de mí', '2025-06-16', 2),
  ('/assets/img/2025/junio4.jpeg', 'Dedicarle el cielo a mi cielo, es y será siempre un detalle desde lo profundo de mi corazón', '2025-06-18', 3),
  ('/assets/img/2025/junio5.jpeg', 'Lo hermoso de este momento no tiene comparación', '2025-06-21', 4),
  ('/assets/img/2025/junio6.jpeg', 'Amo tus ocurrencias', '2025-06-23', 5),
  ('/assets/img/2025/junio7.jpeg', 'El que se meta conmigo ya sabe, lleva bala jajajaja', '2025-06-25', 6),
  ('/assets/img/2025/junio8.jpeg', 'Imposible olvidar nuestro primer viaje, todas las aventuras vividas y lo felices que fuimos', '2025-06-28', 7),
  ('/assets/img/2025/julio1.jpeg', 'Un paseito inolvidable, muchas aventuras, mucho amor y sobre todo un amor muy lindo', '2025-07-04', 0),
  ('/assets/img/2025/julio2.jpeg', 'Desbordados de amor, amaba recogerte y que me recibieras con una sonrisa, un beso, un te amo y una pizza', '2025-07-08', 1),
  ('/assets/img/2025/julio3.jpeg', 'Salidita a cenar, bailar y amarnos mucho mucho', '2025-07-13', 2),
  ('/assets/img/2025/julio4.jpeg', 'Sesión de fotos en el parque con el primo', '2025-07-15', 3),
  ('/assets/img/2025/julio5.jpeg', 'Salidita de novios, sesión de fotos y amor que se desborda', '2025-07-22', 4),
  ('/assets/img/2025/julio6.jpeg', 'La dueña de las carreteras y dueña de mi corazón', '2025-07-22', 5),
  ('/assets/img/2025/julio7.jpeg', 'No tengo palabras para describir lo orgulloso que me sentia en ese momento de que fueras mi novia', '2025-07-25', 6),
  ('/assets/img/2025/julio8.jpeg', '¿Recuerdas esa hamburguesa?', '2025-07-25', 7),
  ('/assets/img/2025/agosto1.jpeg', 'Ámame toda la vida', '2025-08-11', 0),
  ('/assets/img/2025/agosto2.jpeg', 'Visitandote en el trabajo de tu mamá', '2025-08-15', 1),
  ('/assets/img/2025/agosto3.jpeg', 'Felicidad en el cumple de ''Chofi''', '2025-08-18', 2),
  ('/assets/img/2025/agosto4.jpeg', 'Simplemente divinos', '2025-08-18', 3),
  ('/assets/img/2025/agosto5.jpeg', 'Visita al cementerio', '2025-08-22', 4),
  ('/assets/img/2025/agosto6.jpeg', 'Increíble momento', '2025-08-24', 5),
  ('/assets/img/2025/agosto7.jpeg', 'Me encanta hacerte feliz', '2025-08-29', 6),
  ('/assets/img/2025/agosto8.jpeg', 'Día de picnic', '2025-08-30', 7),
  -- Estas cuatro estaban en la primera versión sin fecha (julio de 2025):
  -- ajusta la fecha real desde el panel.
  ('/assets/img/CitaPostres.jpeg', 'Nuestra cita de postres, dulces momentos compartidos', '2025-07-01', 10),
  ('/assets/img/CitaPostres2.jpeg', 'Risas y postres, la combinación perfecta contigo', '2025-07-01', 11),
  ('/assets/img/Flores.jpeg', 'Las flores que te regalé, tan hermosas como tú', '2025-07-01', 12),
  ('/assets/img/PalosTiros.jpeg', 'Aventuras y juegos, contigo todo es divertido', '2025-07-01', 13);
