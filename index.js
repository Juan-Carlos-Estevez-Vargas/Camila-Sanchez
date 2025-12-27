const fotos = [
  "assets/img/CitaPostres.jpeg",
  "assets/img/CitaPostres2.jpeg",
  "assets/img/Flores.jpeg",
  "assets/img/PalosTiros.jpeg",
];

// Datos organizados por meses con fotos y mensajes
const fotosPorMes = [
  {
    mes: "Enero",
    año: "2023",
    fotos: [
      {
        url: "assets/img/enero1.jpg",
        mensaje: "Empezamos el año juntos, nuestro primer amanecer del 2023",
        fecha: "1 de Enero 2023",
      },
      {
        url: "assets/img/enero2.jpg",
        mensaje: "Esa tarde de risas interminables en el parque",
        fecha: "15 de Enero 2023",
      },
    ],
  },
  {
    mes: "Febrero",
    año: "2023",
    fotos: [
      {
        url: "assets/img/febrero1.jpg",
        mensaje: "San Valentín contigo, el mejor regalo",
        fecha: "14 de Febrero 2023",
      },
    ],
  },
  {
    mes: "Marzo",
    año: "2023",
    fotos: [
      {
        url: "assets/img/marzo1.jpg",
        mensaje: "Nuestra primera salida a la montaña juntos",
        fecha: "5 de Marzo 2023",
      },
    ],
  },
  {
    mes: "Abril",
    año: "2023",
    fotos: [
      {
        url: "assets/img/abril1.jpg",
        mensaje:
          "Celebrando tu cumpleaños, el día que el mundo se volvió más brillante",
        fecha: "20 de Abril 2023",
      },
    ],
  },
  {
    mes: "Mayo",
    año: "2023",
    fotos: [
      {
        url: "assets/img/mayo1.jpg",
        mensaje: "Esa lluviosa tarde de películas y abrazos",
        fecha: "10 de Mayo 2023",
      },
    ],
  },
  {
    mes: "Junio",
    año: "2023",
    fotos: [
      {
        url: "assets/img/junio1.jpg",
        mensaje: "Nuestro primer viaje juntos, momentos inolvidables",
        fecha: "3 de Junio 2023",
      },
    ],
  },
  {
    mes: "Julio",
    año: "2023",
    fotos: [
      {
        url: "assets/img/julio1.jpg",
        mensaje: "Verano contigo es mi estación favorita",
        fecha: "15 de Julio 2023",
      },
    ],
  },
  {
    mes: "Agosto",
    año: "2023",
    fotos: [
      {
        url: "assets/img/agosto1.jpg",
        mensaje: "Atardeceres de agosto, contigo todo es más hermoso",
        fecha: "22 de Agosto 2023",
      },
    ],
  },
  {
    mes: "Septiembre",
    año: "2023",
    fotos: [
      {
        url: "assets/img/septiembre1.jpg",
        mensaje: "Celebrando nuestro aniversario de meses",
        fecha: "5 de Septiembre 2023",
      },
    ],
  },
  {
    mes: "Octubre",
    año: "2023",
    fotos: [
      {
        url: "assets/img/octubre1.jpg",
        mensaje: "Halloween juntos, disfraces y dulces compartidos",
        fecha: "31 de Octubre 2023",
      },
    ],
  },
  {
    mes: "Noviembre",
    año: "2023",
    fotos: [
      {
        url: "assets/img/noviembre1.jpg",
        mensaje: "Día de gracias, agradecido por tenerte en mi vida",
        fecha: "23 de Noviembre 2023",
      },
    ],
  },
  {
    mes: "Diciembre",
    año: "2023",
    fotos: [
      {
        url: "assets/img/diciembre1.jpg",
        mensaje: "Nuestra primera Navidad juntos, el mejor regalo eres tú",
        fecha: "24 de Diciembre 2023",
      },
      {
        url: "assets/img/CitaPostres.jpeg",
        mensaje: "Nuestra cita de postres, dulces momentos compartidos",
        fecha: "15 de Diciembre 2023",
      },
      {
        url: "assets/img/CitaPostres2.jpeg",
        mensaje: "Risas y postres, la combinación perfecta contigo",
        fecha: "15 de Diciembre 2023",
      },
      {
        url: "assets/img/Flores.jpeg",
        mensaje: "Las flores que te regalé, tan hermosas como tú",
        fecha: "10 de Diciembre 2023",
      },
      {
        url: "assets/img/PalosTiros.jpeg",
        mensaje: "Aventuras y juegos, contigo todo es divertido",
        fecha: "20 de Diciembre 2023",
      },
    ],
  },
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

  // Agregar estilos para la sorpresa
  const estilo = document.createElement("style");
  estilo.textContent = `
    .sorpresa {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      animation: aparecer 0.5s ease;
    }
    
    .sorpresa-contenido {
      background: linear-gradient(135deg, #ff4081, #c2185b);
      padding: 3em;
      border-radius: 20px;
      text-align: center;
      max-width: 500px;
      animation: latido 1s infinite alternate;
    }
    
    .sorpresa-texto {
      font-size: 2rem;
      margin: 1em 0;
      font-weight: bold;
      color: #ffeb3b;
    }
    
    @keyframes aparecer {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes latido {
      from { transform: scale(1); }
      to { transform: scale(1.05); }
    }
  `;
  document.head.appendChild(estilo);
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
let fotoIndex = 0;
let fotosDelMesActual = [];

// Generar la línea de tiempo por meses
function generarLineaTiempo() {
  const container = document.getElementById("meses-container");
  container.innerHTML = "";

  fotosPorMes.forEach((mesData, index) => {
    const mesItem = document.createElement("div");
    mesItem.className = "mes-item";
    mesItem.dataset.mesIndex = index;

    // Agregar clase activa al mes actual
    const fechaActual = new Date();
    const mesActualNum = fechaActual.getMonth();
    if (index === mesActualNum) {
      mesItem.classList.add("activo");
    }

    mesItem.innerHTML = `
      <div class="mes-nombre">${mesData.mes}</div>
      <div class="mes-año">${mesData.año}</div>
      <div class="mes-contador">${mesData.fotos.length}</div>
    `;

    mesItem.addEventListener("click", () => abrirCarrusel(index));
    container.appendChild(mesItem);
  });
}

// Abrir carrusel con las fotos de un mes específico
function abrirCarrusel(mesIndex) {
  mesActual = mesIndex;
  fotoIndex = 0;
  fotosDelMesActual = fotosPorMes[mesIndex].fotos;

  // Actualizar UI del carrusel
  document.getElementById(
    "carruselMes"
  ).textContent = `${fotosPorMes[mesIndex].mes} ${fotosPorMes[mesIndex].año}`;

  // Cargar la primera foto
  cargarFotoCarrusel(0);

  // Generar miniaturas
  generarMiniaturas();

  // Mostrar modal
  document.getElementById("carruselModal").style.display = "block";
  document.body.style.overflow = "hidden"; // Prevenir scroll

  // Efecto de aparición
  setTimeout(() => {
    crearCorazonFlotante();
  }, 300);
}

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
  carruselFecha.textContent = foto.fecha;
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

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  // Generar línea de tiempo
  generarLineaTiempo();

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

  // Cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarCarrusel();
    } else if (e.key === "ArrowLeft") {
      navegarCarrusel(-1);
    } else if (e.key === "ArrowRight") {
      navegarCarrusel(1);
    }
  });

  // Cerrar al hacer clic fuera del contenido
  document.getElementById("carruselModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("carruselModal")) {
      cerrarCarrusel();
    }
  });

  // Abrir automáticamente el mes actual al cargar
  setTimeout(() => {
    const fechaActual = new Date();
    const mesActualNum = fechaActual.getMonth();
    const mesActualItem = document.querySelector(
      `.mes-item[data-mes-index="${mesActualNum}"]`
    );
    if (mesActualItem) {
      mesActualItem.classList.add("activo");
    }
  }, 1000);
});

// Función para agregar una foto nueva (opcional)
function agregarFoto(mes, año, url, mensaje, fecha) {
  const mesIndex = fotosPorMes.findIndex((m) => m.mes === mes && m.año === año);

  if (mesIndex !== -1) {
    fotosPorMes[mesIndex].fotos.push({ url, mensaje, fecha });
  } else {
    fotosPorMes.push({
      mes,
      año,
      fotos: [{ url, mensaje, fecha }],
    });
  }

  // Actualizar la vista
  generarLineaTiempo();
}
// Para el archivo JavaScript principal, agrega esto al final:

// Efecto de confeti al abrir carrusel
function lanzarConfeti() {
  const colores = ["#ff4081", "#c2185b", "#ec407a", "#ff9800", "#4caf50"];
  const modal = document.getElementById("carruselModal");

  for (let i = 0; i < 50; i++) {
    const confeti = document.createElement("div");
    confeti.className = "confeti";
    confeti.style.cssText = `
      position: absolute;
      width: 10px;
      height: 10px;
      background: ${colores[Math.floor(Math.random() * colores.length)]};
      top: -20px;
      left: ${Math.random() * 100}%;
      border-radius: ${Math.random() > 0.5 ? "50%" : "0"};
      animation: caerConfeti ${Math.random() * 3 + 2}s linear forwards;
      z-index: 10001;
    `;

    modal.appendChild(confeti);

    // Remover después de la animación
    setTimeout(() => confeti.remove(), 5000);
  }
}

// Agregar estilo para el confeti
const estiloConfeti = document.createElement("style");
estiloConfeti.textContent = `
  @keyframes caerConfeti {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(360deg);
      opacity: 0;
    }
  }
`;
document.head.appendChild(estiloConfeti);

// Actualizar la función abrirCarrusel para incluir confeti
function abrirCarrusel(mesIndex) {
  // ... código anterior ...

  // Lanzar confeti
  setTimeout(() => {
    lanzarConfeti();
  }, 500);
}
