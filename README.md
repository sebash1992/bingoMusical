# 🎵 Bingo Musical

Bingo con canciones de YouTube. El admin crea una mesa, carga canciones y reparte cartones únicos a cada jugador. Cuando suena una canción, los jugadores la marcan en su cartón. ¡El primero en completarlo canta BINGO!

## Stack
- **Frontend**: React + Vite → Vercel
- **Backend**: Node.js + Express + Socket.io → Railway

---

## 🚀 Deploy

### 1. Backend en Railway
1. Creá cuenta en [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Root Directory: `backend`
4. Copiá la URL pública (ej: `https://bingo-musical.up.railway.app`)

### 2. Frontend en Vercel
1. Creá cuenta en [vercel.com](https://vercel.com)
2. New Project → importá el repo
3. Root Directory: `frontend`, Framework: Vite
4. Environment Variables:
   ```
   VITE_BACKEND_URL=https://bingo-musical.up.railway.app
   ```
5. Deploy 🎉

---

## 💻 Local

### Backend
```bash
cd backend
npm install
npm run dev
# → http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
# → http://localhost:5173
```

---

## 🎮 Cómo jugar

### Admin:
1. **Crear Mesa** → ponés tu nombre, el tamaño del cartón (3×3, 4×4 o 5×5), la duración del clip y todas las canciones (necesitás mínimo `tamaño²` canciones con nombre)
2. Compartís el link con los jugadores
3. Cuando todos están listos, apretás **Iniciar Juego** → se reparten cartones únicos a cada uno
4. Vas reproduciendo canciones de a una con ▶ Reproducir
5. Después de reproducir apretás **Revelar canción** → los jugadores pueden marcarla en su cartón
6. Cuando alguien canta BINGO tenés tres opciones:
   - 🏆 **Confirmar y terminar** — ganó, se acabó el juego
   - 🏅 **Confirmar y seguir** — anota el ganador pero el juego continúa
   - ❌ **Rechazar** — falso bingo, el juego sigue

### Jugadores:
1. Entran al link del admin, ponen su nombre
2. Esperan que el admin inicie el juego
3. Reciben su cartón único con canciones
4. Cuando suena una canción y la reconocen, tocan la celda en su cartón (solo pueden marcar canciones ya reveladas por el admin)
5. Cuando tienen el cartón completo, aprietan **¡BINGO!**

---

## 📁 Estructura
```
bingo-musical/
├── backend/
│   ├── src/index.js       # Servidor Socket.io con toda la lógica
│   ├── package.json
│   └── railway.toml
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Home.jsx
    │   │   ├── AdminSetup.jsx   # Configurar mesa y canciones
    │   │   ├── AdminGame.jsx    # Panel del admin
    │   │   ├── PlayerJoin.jsx
    │   │   └── PlayerGame.jsx   # Cartón del jugador
    │   ├── components/
    │   │   ├── BingoCard.jsx    # El cartón interactivo
    │   │   └── YouTubePlayer.jsx
    │   └── context/SocketContext.jsx
    └── package.json
```
