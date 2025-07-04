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
