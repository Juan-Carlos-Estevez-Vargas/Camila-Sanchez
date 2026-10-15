const fotos = [
  "assets/img/CitaPostres.jpeg",
  "assets/img/CitaPostres2.jpeg",
  "assets/img/Flores.jpeg",
  "assets/img/PalosTiros.jpeg",
];

const galeria = document.getElementById("galeria");

fotos.forEach((url, i) => {
  const foto = document.createElement("div");
  foto.className = "photo";
  foto.style.backgroundImage = `url(${url})`;
  foto.style.setProperty("--r", Math.random().toFixed(2));
  galeria.appendChild(foto);
});

const floatingContainer = document.getElementById("floating-container");
const emojis = ["❤️", "💖", "💘", "🌸", "🌺", "🌷", "💐", "🌹"];
const total = 40;

for (let i = 0; i < total; i++) {
  const span = document.createElement("span");
  span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  span.style.left = Math.random() * 100 + "vw";
  span.style.animationDuration = 8 + Math.random() * 5 + "s";
  span.style.fontSize = 1 + Math.random() * 2 + "rem";
  floatingContainer.appendChild(span);
}

// Contador de tiempo juntos (configura tu fecha de inicio)
const fechaInicio = new Date("2025-05-31");

function actualizarContador() {
  const ahora = new Date();
  const diferencia = ahora - fechaInicio;

  const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
  const horas = Math.floor(
    (diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
  const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);

  document.getElementById("dias").textContent = dias;
  document.getElementById("horas").textContent = horas;
  document.getElementById("minutos").textContent = minutos;
  document.getElementById("segundos").textContent = segundos;
}

// Iniciar contador
actualizarContador();
setInterval(actualizarContador, 1000);

// Control de música navideña
const musica = document.getElementById("musica-navidad");
const btnMusica = document.getElementById("toggle-musica");

btnMusica.addEventListener("click", () => {
  if (musica.paused) {
    musica.play();
    btnMusica.textContent = "🔇 Pausar Música";
  } else {
    musica.pause();
    btnMusica.textContent = "🎵 Música Navideña";
  }
});

// Efecto de nieve adicional
function crearNieve() {
  const navidad = document.querySelector(".navidad");
  for (let i = 0; i < 50; i++) {
    const copo = document.createElement("div");
    copo.innerHTML = "❄️";
    copo.style.position = "absolute";
    copo.style.left = Math.random() * 100 + "vw";
    copo.style.fontSize = Math.random() * 20 + 10 + "px";
    copo.style.opacity = Math.random() * 0.5 + 0.3;
    copo.style.animation = `caerNieve ${
      Math.random() * 10 + 5
    }s linear infinite`;
    copo.style.animationDelay = Math.random() * 5 + "s";
    navidad.appendChild(copo);
  }
}

// Regalo sorpresa
function mostrarSorpresa() {
  if (document.querySelector(".sorpresa")) return;
  const sorpresa = document.createElement("div");
  sorpresa.className = "sorpresa";
  sorpresa.innerHTML = `
    <div class="sorpresa-contenido">
      <h3>🎁 ¡Sorpresa! 🎁</h3>
      <p>Mi amor, mi regalo más grande para ti en esta Navidad es...</p>
      <p class="sorpresa-texto">💝 MI AMOR ETERNO 💝</p>
      <p>Prometo amarte, cuidarte y hacerte feliz cada día de mi vida.</p>
      <button onclick="cerrarSorpresa()">❤️ Cerrar</button>
    </div>
  `;

  document.body.appendChild(sorpresa);

}

function cerrarSorpresa() {
  const sorpresa = document.querySelector(".sorpresa");
  if (sorpresa) {
    sorpresa.remove();
  }
}

// Inicializar efectos navideños cuando la página cargue
window.addEventListener("load", () => {
  crearNieve();

  // Efecto de entrada para las secciones
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  });

  // Agregar transiciones a todas las secciones
  const secciones = document.querySelectorAll(".navidad, .mensajes, .contador");
  secciones.forEach((seccion) => {
    seccion.style.opacity = "0";
    seccion.style.transform = "translateY(20px)";
    seccion.style.transition = "opacity 0.8s ease, transform 0.8s ease";
    observer.observe(seccion);
  });
});

// Variables globales para el carrusel
let mesActual = null;
let añoActual = 0;
let fotoIndex = 0;
let fotosDelMesActual = [];

// Cargar foto específica en el carrusel
function cargarFotoCarrusel(index) {
  if (fotosDelMesActual.length === 0) return;

  const foto = fotosDelMesActual[index];
  const fotoAmpliada = document.getElementById("fotoAmpliada");
  const fotoMensaje = document.getElementById("fotoMensaje");
  const carruselFecha = document.getElementById("carruselFecha");
  const fotoActual = document.getElementById("fotoActual");
  const totalFotos = document.getElementById("totalFotos");

  // Actualizar foto
  fotoAmpliada.style.backgroundImage = `url('${foto.url}')`;
  fotoAmpliada.style.backgroundSize = "cover";
  fotoAmpliada.style.backgroundPosition = "center";
  fotoAmpliada.style.backgroundRepeat = "no-repeat";

  // Actualizar información
  fotoMensaje.textContent = foto.mensaje;
  //carruselFecha.textContent = foto.fecha;
  fotoActual.textContent = index + 1;
  totalFotos.textContent = fotosDelMesActual.length;

  // Actualizar miniatura activa
  document.querySelectorAll(".miniatura").forEach((miniatura, i) => {
    miniatura.classList.toggle("activa", i === index);
  });

  // Actualizar índice actual
  fotoIndex = index;
}

// Generar miniaturas para el carrusel
function generarMiniaturas() {
  const container = document.getElementById("miniaturasContainer");
  container.innerHTML = "";

  fotosDelMesActual.forEach((foto, index) => {
    const miniatura = document.createElement("div");
    miniatura.className = `miniatura ${index === 0 ? "activa" : ""}`;
    miniatura.style.backgroundImage = `url('${foto.url}')`;
    miniatura.dataset.index = index;

    miniatura.addEventListener("click", () => {
      cargarFotoCarrusel(index);
      crearCorazonFlotante();
    });

    container.appendChild(miniatura);
  });
}

// Navegación del carrusel
function navegarCarrusel(direccion) {
  let nuevoIndex = fotoIndex + direccion;

  if (nuevoIndex < 0) {
    nuevoIndex = fotosDelMesActual.length - 1;
  } else if (nuevoIndex >= fotosDelMesActual.length) {
    nuevoIndex = 0;
  }

  cargarFotoCarrusel(nuevoIndex);
  crearCorazonFlotante();
}

// Efecto de corazón flotante
function crearCorazonFlotante() {
  const modal = document.getElementById("carruselModal");
  const corazon = document.createElement("div");
  corazon.className = "corazon-flotante";
  corazon.innerHTML = "❤️";

  // Posición aleatoria cerca de la foto
  const x = 50 + (Math.random() * 20 - 10);
  const y = 50 + (Math.random() * 20 - 10);

  corazon.style.left = `${x}%`;
  corazon.style.top = `${y}%`;

  modal.querySelector(".carrusel-contenido").appendChild(corazon);

  // Remover después de la animación
  setTimeout(() => {
    corazon.remove();
  }, 1500);
}

// Cerrar carrusel
function cerrarCarrusel() {
  document.getElementById("carruselModal").style.display = "none";
  document.body.style.overflow = "auto"; // Restaurar scroll
}

// Datos organizados por años y meses
const fotosPorAño = [
  {
    año: "2025",
    color: "#ff4081", // Color distintivo para cada año
    fotos: {
      Mayo: [
        {
          url: "assets/img/2025/mayo1.jpeg",
          mensaje:
            "Aquí, aún no éramos novios pero el verte trabajar me alegraba mucho el alma",
          fecha: "10 de Mayo 2025",
        },
        {
          url: "assets/img/2025/mayo2.jpeg",
          mensaje:
            "Cómo olvidar el día en que con mucho nerviosismo, te pedí poder compartir una vida contigo y ser novios",
          fecha: "30 de Mayo 2025",
        },
      ],
      Junio: [
        {
          url: "assets/img/2025/junio1.jpeg",
          mensaje:
            "Tus primeras flores, cómo olvidar la emoción que sentía al esperar tu reacción",
          fecha: "9 de Junio 2025",
        },
        {
          url: "assets/img/2025/junio2.jpeg",
          mensaje: "Mi primer fondo de pantalla alusivo a tí",
          fecha: "10 de Junio 2025",
        },
        {
          url: "assets/img/2025/junio3.jpeg",
          mensaje: "Lo hermosa que te ves enamorada de mí",
          fecha: "16 de Junio 2025",
        },
        {
          url: "assets/img/2025/junio4.jpeg",
          mensaje:
            "Dedicarle el cielo a mi cielo, es y será siempre un detalle desde lo profundo de mi corazón",
          fecha: "18 de Junio 2025",
        },
        {
          url: "assets/img/2025/junio5.jpeg",
          mensaje: "Lo hermoso de este momento no tiene comparación",
          fecha: "21 de Junio 2025",
        },
        {
          url: "assets/img/2025/junio6.jpeg",
          mensaje: "Amo tus ocurrencias",
          fecha: "23 de Junio 2025",
        },
        {
          url: "assets/img/2025/junio7.jpeg",
          mensaje: "El que se meta conmigo ya sabe, lleva bala jajajaja",
          fecha: "25 de Junio 2025",
        },
        {
          url: "assets/img/2025/junio8.jpeg",
          mensaje:
            "Imposible olvidar nuestro primer viaje, todas las aventuras vividas y lo felices que fuimos",
          fecha: "28 de Junio 2025",
        },
      ],
      Julio: [
        {
          url: "assets/img/2025/julio1.jpeg",
          mensaje:
            "Un paseito inolvidable, muchas aventuras, mucho amor y sobre todo un amor muy lindo",
          fecha: "4 de Julio 2025",
        },
        {
          url: "assets/img/2025/julio2.jpeg",
          mensaje:
            "Desbordados de amor, amaba recogerte y que me recibieras con una sonrisa, un beso, un te amo y una pizza",
          fecha: "8 de Julio 2025",
        },
        {
          url: "assets/img/2025/julio3.jpeg",
          mensaje: "Salidita a cenar, bailar y amarnos mucho mucho",
          fecha: "13 de Julio 2025",
        },
        {
          url: "assets/img/2025/julio4.jpeg",
          mensaje: "Sesión de fotos en el parque con el primo",
          fecha: "15 de Julio 2025",
        },
        {
          url: "assets/img/2025/julio5.jpeg",
          mensaje: "Salidita de novios, sesión de fotos y amor que se desborda",
          fecha: "22 de Julio 2025",
        },
        {
          url: "assets/img/2025/julio6.jpeg",
          mensaje: "La dueña de las carreteras y dueña de mi corazón",
          fecha: "22 de Julio 2025",
        },
        {
          url: "assets/img/2025/julio7.jpeg",
          mensaje:
            "No tengo palabras para describir lo orgulloso que me sentia en ese momento de que fueras mi novia",
          fecha: "25 de Julio 2025",
        },
        {
          url: "assets/img/2025/julio8.jpeg",
          mensaje: "¿Recuerdas esa hamburguesa?",
          fecha: "25 de Julio 2025",
        },
      ],
      Agosto: [
        {
          url: "assets/img/2025/agosto1.jpeg",
          mensaje: "Ámame toda la vida",
          fecha: "11 de Agosto 2025",
        },
        {
          url: "assets/img/2025/agosto2.jpeg",
          mensaje: "Visitandote en el trabajo de tu mamá",
          fecha: "15 de Agosto 2025",
        },
        {
          url: "assets/img/2025/agosto3.jpeg",
          mensaje: "Felicidad en el cumple de 'Chofi'",
          fecha: "18 de Agosto 2025",
        },
        {
          url: "assets/img/2025/agosto4.jpeg",
          mensaje: "Simplemente divinos",
          fecha: "18 de Agosto 2025",
        },
        {
          url: "assets/img/2025/agosto5.jpeg",
          mensaje: "Visita al cementerio",
          fecha: "22 de Agosto 2025",
        },
        {
          url: "assets/img/2025/agosto6.jpeg",
          mensaje: "Increíble momento",
          fecha: "24 de Agosto 2025",
        },
        {
          url: "assets/img/2025/agosto7.jpeg",
          mensaje: "Me encanta hacerte feliz",
          fecha: "29 de Agosto 2025",
        },
        {
          url: "assets/img/2025/agosto8.jpeg",
          mensaje: "Día de picnic",
          fecha: "30 de Agosto 2025",
        },
      ],
    },
  },
];

// Iconos para cada mes
const iconosMeses = {
  Enero: "❄️",
  Febrero: "💖",
  Marzo: "🌸",
  Abril: "🌧️",
  Mayo: "🌺",
  Junio: "☀️",
  Julio: "🏖️",
  Agosto: "🔥",
  Septiembre: "🍂",
  Octubre: "🎃",
  Noviembre: "🦃",
  Diciembre: "🎄",
};

// Generar selector de años
function generarSelectorAnios() {
  const container = document.getElementById("selectorAnios");
  container.innerHTML = "";

  fotosPorAño.forEach((añoData, index) => {
    const añoItem = document.createElement("div");
    añoItem.className = "ano-item";
    añoItem.dataset.añoIndex = index;
    añoItem.style.setProperty("--color-ano", añoData.color);
    añoItem.style.color = añoData.color;

    // Calcular total de fotos del año
    let totalFotos = 0;
    Object.values(añoData.fotos).forEach((mesFotos) => {
      totalFotos += mesFotos.length;
    });

    // Calcular meses con fotos
    const mesesConFotos = Object.keys(añoData.fotos).filter(
      (mes) => añoData.fotos[mes].length > 0
    ).length;

    añoItem.innerHTML = `
      <div class="ano-numero">${añoData.año}</div>
      <div class="ano-contador">
        ${totalFotos} fotos en ${mesesConFotos} meses
      </div>
      ${añoData.año === "2025" ? '<div class="estrellas">★</div>' : ""}
    `;

    añoItem.addEventListener("click", () => seleccionarAño(index));
    container.appendChild(añoItem);
  });

  // Seleccionar año actual por defecto
  setTimeout(() => {
    const añoActual = new Date().getFullYear().toString();
    const añoIndex = fotosPorAño.findIndex((a) => a.año === añoActual);
    if (añoIndex !== -1) {
      seleccionarAño(añoIndex);
    } else {
      // Si no hay año actual, seleccionar el primero
      seleccionarAño(0);
    }
  }, 500);
}

// Seleccionar año
function seleccionarAño(añoIndex) {
  añoActual = añoIndex;

  // Actualizar UI de años
  document.querySelectorAll(".ano-item").forEach((item, index) => {
    item.classList.toggle("activo", index === añoIndex);
  });

  // Mostrar selector de meses
  const selectorAnios = document.getElementById("selectorAnios");
  const selectorMeses = document.getElementById("selectorMeses");

  // Animación de transición
  selectorAnios.classList.add("vista-salida");

  setTimeout(() => {
    selectorAnios.style.display = "none";
    selectorAnios.classList.remove("vista-salida");

    // Generar meses del año seleccionado
    generarMesesDelAño(añoIndex);

    selectorMeses.style.display = "block";
    selectorMeses.classList.add("vista-entrada");

    // Actualizar progreso del año
    actualizarProgresoAnual(añoIndex);
  }, 500);
}

// Generar meses de un año específico
function generarMesesDelAño(añoIndex) {
  const container = document.getElementById("mesesGrid");
  const añoData = fotosPorAño[añoIndex];
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  container.innerHTML = "";

  meses.forEach((mesNombre, index) => {
    const mesItem = document.createElement("div");
    const fotosMes = añoData.fotos[mesNombre] || [];
    const tieneFotos = fotosMes.length > 0;

    mesItem.className = `mes-item ${!tieneFotos ? "mes-vacio" : ""}`;
    mesItem.dataset.mes = mesNombre;
    mesItem.style.setProperty("--color-mes", añoData.color);

    // Calcular color más claro para el hover
    const colorClaro = ajustarBrillo(añoData.color, 40);
    mesItem.style.setProperty("--color-mes-claro", colorClaro);

    const mensaje = tieneFotos
      ? `${fotosMes.length} recuerdo${fotosMes.length !== 1 ? "s" : ""}`
      : "Sin fotos aún";

    mesItem.innerHTML = `
      <div class="mes-icono">${iconosMeses[mesNombre] || "📷"}</div>
      <div class="mes-nombre">${mesNombre}</div>
      <div class="mes-contador-fotos">${mensaje}</div>
    `;

    if (tieneFotos) {
      mesItem.addEventListener("click", () => abrirCarrusel(mesNombre));
      mesItem.style.cursor = "pointer";
    } else {
      mesItem.style.cursor = "not-allowed";
    }

    container.appendChild(mesItem);
  });
}

// Función para ajustar brillo de color
function ajustarBrillo(hex, percent) {
  // Convierte hex a RGB
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  // Ajusta el brillo
  r = Math.min(255, r + percent);
  g = Math.min(255, g + percent);
  b = Math.min(255, b + percent);

  // Vuelve a hex
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Actualizar progreso anual
function actualizarProgresoAnual(añoIndex) {
  const añoData = fotosPorAño[añoIndex];
  const meses = Object.keys(añoData.fotos);
  const mesesConFotos = meses.filter(
    (mes) => añoData.fotos[mes].length > 0
  ).length;
  const porcentaje = Math.round((mesesConFotos / 12) * 100);

  // Crear o actualizar barra de progreso
  let progresoContainer = document.querySelector(".progreso-ano");
  if (!progresoContainer) {
    progresoContainer = document.createElement("div");
    progresoContainer.className = "progreso-ano";
    progresoContainer.innerHTML = `
      <h4 class="progreso-titulo">📊 Progreso del ${añoData.año}</h4>
      <div class="barra-progreso">
        <div class="progreso-lleno" style="width: ${porcentaje}%"></div>
      </div>
      <div class="progreso-texto">
        <span>${mesesConFotos} de 12 meses con recuerdos</span>
        <span>${porcentaje}% completado</span>
      </div>
    `;
    document.getElementById("selectorMeses").appendChild(progresoContainer);
  } else {
    progresoContainer.innerHTML = `
      <h4 class="progreso-titulo">📊 Progreso del ${añoData.año}</h4>
      <div class="barra-progreso">
        <div class="progreso-lleno" style="width: ${porcentaje}%"></div>
      </div>
      <div class="progreso-texto">
        <span>${mesesConFotos} de 12 meses con recuerdos</span>
        <span>${porcentaje}% completado</span>
      </div>
    `;
  }
}

// Volver a la vista de años
function volverAAnios() {
  const selectorAnios = document.getElementById("selectorAnios");
  const selectorMeses = document.getElementById("selectorMeses");

  selectorMeses.classList.add("vista-salida");

  setTimeout(() => {
    selectorMeses.style.display = "none";
    selectorMeses.classList.remove("vista-salida");

    selectorAnios.style.display = "flex";
    selectorAnios.classList.add("vista-entrada");
  }, 500);
}

// Abrir carrusel con las fotos de un mes específico
function abrirCarrusel(mesNombre) {
  mesActual = mesNombre;
  fotoIndex = 0;
  const añoData = fotosPorAño[añoActual];
  fotosDelMesActual = añoData.fotos[mesNombre] || [];

  if (fotosDelMesActual.length === 0) return;

  // Configurar color del año en el carrusel
  const color = añoData.color;
  const rgb = hexToRgb(color);

  // Actualizar UI del carrusel
  // document.getElementById(
  //   "carruselMes"
  // ).textContent = `${mesNombre} ${añoData.año}`;
  // document.getElementById("carruselAno").textContent = añoData.año;

  // // Establecer variables CSS para el color
  // const carruselHeader = document.querySelector(".carrusel-info");
  // carruselHeader.style.setProperty("--color-r", rgb.r);
  // carruselHeader.style.setProperty("--color-g", rgb.g);
  // carruselHeader.style.setProperty("--color-b", rgb.b);

  // Cargar la primera foto
  cargarFotoCarrusel(0);

  // Generar miniaturas
  generarMiniaturas();

  // Mostrar modal
  const modal = document.getElementById("carruselModal");
  modal.style.display = "block";
  document.body.style.overflow = "hidden";

  // Efecto especial
  setTimeout(() => {
    crearEfectoEspecial(mesNombre);
  }, 300);
}

// Convertir hex a RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 64, b: 129 }; // Color por defecto
}

// Efecto especial según el mes
function crearEfectoEspecial(mes) {
  const modal = document.getElementById("carruselModal");
  const efectos = {
    Diciembre: () => lanzarCoposNieve(modal),
    Febrero: () => lanzarCorazones(modal),
    Julio: () => lanzarSoles(modal),
    Abril: () => lanzarGotasLluvia(modal),
    Octubre: () => lanzarCalabazas(modal),
  };

  if (efectos[mes]) {
    efectos[mes]();
  } else {
    lanzarEstrellas(modal);
  }
}

// Efectos visuales
function lanzarCorazones(container) {
  for (let i = 0; i < 30; i++) {
    const corazon = document.createElement("div");
    corazon.innerHTML = "❤️";
    corazon.style.cssText = `
      position: absolute;
      font-size: ${Math.random() * 20 + 15}px;
      top: -30px;
      left: ${Math.random() * 100}%;
      animation: caerCorazon ${Math.random() * 3 + 2}s linear forwards;
      z-index: 10001;
      opacity: ${Math.random() * 0.5 + 0.5};
    `;

    container.appendChild(corazon);
    setTimeout(() => corazon.remove(), 5000);
  }
}

// Lluvia genérica de emojis usada por los efectos de cada mes
function lanzarEmojis(container, emoji, cantidad = 30) {
  for (let i = 0; i < cantidad; i++) {
    const item = document.createElement("div");
    item.textContent = emoji;
    item.style.cssText = `
      position: absolute;
      font-size: ${Math.random() * 20 + 15}px;
      top: -30px;
      left: ${Math.random() * 100}%;
      animation: caerCorazon ${Math.random() * 3 + 2}s linear forwards;
      z-index: 10001;
      pointer-events: none;
    `;
    container.appendChild(item);
    setTimeout(() => item.remove(), 5000);
  }
}

const lanzarSoles = (container) => lanzarEmojis(container, "☀️");
const lanzarGotasLluvia = (container) => lanzarEmojis(container, "💧");
const lanzarCalabazas = (container) => lanzarEmojis(container, "🎃");
const lanzarEstrellas = (container) => lanzarEmojis(container, "✨");

function lanzarCoposNieve(container) {
  for (let i = 0; i < 40; i++) {
    const copo = document.createElement("div");
    copo.innerHTML = "❄️";
    copo.style.cssText = `
      position: absolute;
      font-size: ${Math.random() * 15 + 10}px;
      top: -30px;
      left: ${Math.random() * 100}%;
      animation: caerCopo ${Math.random() * 4 + 3}s linear forwards;
      z-index: 10001;
      opacity: ${Math.random() * 0.7 + 0.3};
    `;

    container.appendChild(copo);
    setTimeout(() => copo.remove(), 7000);
  }
}

// Agregar estas animaciones al CSS
const efectosCSS = document.createElement("style");
efectosCSS.textContent = `
  @keyframes caerCorazon {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(360deg);
      opacity: 0;
    }
  }
  
  @keyframes caerCopo {
    0% {
      transform: translateY(0) rotate(0deg) translateX(0);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(360deg) translateX(${
        Math.random() * 100 - 50
      }px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(efectosCSS);

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  // Generar selector de años
  generarSelectorAnios();

  // Event listeners para el carrusel
  document
    .getElementById("cerrarCarrusel")
    .addEventListener("click", cerrarCarrusel);
  document
    .getElementById("prevBtn")
    .addEventListener("click", () => navegarCarrusel(-1));
  document
    .getElementById("nextBtn")
    .addEventListener("click", () => navegarCarrusel(1));
  document.getElementById("btnVolver").addEventListener("click", volverAAnios);

  // Atajos de teclado
  document.addEventListener("keydown", (e) => {
    if (document.getElementById("carruselModal").style.display === "block") {
      if (e.key === "Escape") cerrarCarrusel();
      if (e.key === "ArrowLeft") navegarCarrusel(-1);
      if (e.key === "ArrowRight") navegarCarrusel(1);
    }
  });

  // Cerrar carrusel al hacer clic fuera
  document.getElementById("carruselModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("carruselModal")) {
      cerrarCarrusel();
    }
  });
});

// Función para agregar un año nuevo
function agregarAnioNuevo(año, color = "#4CAF50") {
  const mesesVacios = {
    Enero: [],
    Febrero: [],
    Marzo: [],
    Abril: [],
    Mayo: [],
    Junio: [],
    Julio: [],
    Agosto: [],
    Septiembre: [],
    Octubre: [],
    Noviembre: [],
    Diciembre: [],
  };

  fotosPorAño.unshift({
    año: año.toString(),
    color: color,
    fotos: mesesVacios,
  });

  generarSelectorAnios();
}

// Función para agregar fotos fácilmente
function agregarFotos(año, mes, nuevasFotos) {
  const añoIndex = fotosPorAño.findIndex((a) => a.año === año.toString());

  if (añoIndex === -1) {
    // Si el año no existe, créalo
    agregarAnioNuevo(año);
    const nuevoAñoIndex = 0; // Porque se agrega al principio
    fotosPorAño[nuevoAñoIndex].fotos[mes] = nuevasFotos;
  } else {
    // Si el año existe, agrega las fotos al mes
    if (!fotosPorAño[añoIndex].fotos[mes]) {
      fotosPorAño[añoIndex].fotos[mes] = [];
    }
    fotosPorAño[añoIndex].fotos[mes].push(...nuevasFotos);
  }

  // Actualizar la vista si estamos en ese año
  if (añoActual === añoIndex) {
    generarMesesDelAño(añoIndex);
  }
}

// Ejemplo de uso:
// agregarFotos(2024, "Enero", [
//   {
//     url: "assets/nueva-foto.jpg",
//     mensaje: "Un nuevo recuerdo juntos",
//     fecha: "25 de Enero 2024"
//   }
// ]);
