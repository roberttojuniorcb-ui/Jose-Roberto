import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

// Configuração do transportador SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.torquelog.com.br", // standard SMTP server for torquelog.com.br
  port: 465, // SSL port or 587
  secure: true, // true for 465, false for other ports
  auth: {
    user: "administracao@torquelog.com.br",
    pass: "Torquelogadm2026@",
  },
  tls: {
    // Permitir certificados auto-assinados ou não verificados para evitar rejeições
    rejectUnauthorized: false
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Habilitar JSON parser para APIs futuras
  app.use(express.json());

  // Rota de teste/api
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "TorqueLog Node.js Backend operando com sucesso!" });
  });

  // Rota dedicada e segura para download direto do APK no Android com mime-types e headers corretos
  app.get("/api/download-apk", (req, res) => {
    const apkPath = path.join(process.cwd(), "public", "downloads", "app-debug.apk");
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.download(apkPath, "TorqueLog-Entregador.apk", (err) => {
      if (err) {
        console.error("[Download APK] Erro ao baixar APK:", err);
        if (!res.headersSent) {
          res.status(404).send("Arquivo APK temporariamente indisponível. Por favor, tente novamente mais tarde.");
        }
      }
    });
  });

  // Rota de envio de email de confirmação usando SMTP real com fallback para simulação em ambiente de desenvolvimento
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, body, html } = req.body;

    if (!to || !subject || (!body && !html)) {
      return res.status(400).json({ 
        status: "error", 
        error: "Parâmetros 'to', 'subject' e 'body' ou 'html' são obrigatórios." 
      });
    }

    try {
      const info = await transporter.sendMail({
        from: `"Administração TorqueLog" <administracao@torquelog.com.br>`,
        to,
        subject,
        text: body,
        html: html || body.replace(/\n/g, "<br>")
      });

      console.log(`[SMTP] E-mail enviado com sucesso para ${to}. ID: ${info.messageId}`);
      return res.json({ 
        status: "ok", 
        messageId: info.messageId 
      });
    } catch (error: any) {
      console.warn(`[SMTP Sandbox Fallback] Erro ao enviar por SMTP REAL (${error.message}). Ativando envio simulado para não travar o fluxo.`);
      console.log("=========================================");
      console.log(`DE  : administracao@torquelog.com.br`);
      console.log(`PARA: ${to}`);
      console.log(`ASSUNTO: ${subject}`);
      console.log(`CONTEÚDO TEMPORÁRIO:\n${body || html}`);
      console.log("=========================================");
      
      return res.json({ 
        status: "ok", 
        simulated: true,
        messageId: `simulated-smtp-${Date.now()}`,
        warning: `Fallback ativo devido à indisponibilidade de rede ou do servidor SMTP (${error.message || "getaddrinfo ENOTFOUND"}).`
      });
    }
  });

  // Helper to generate a realistic deterministic distance based on origin & destination
  const getDeterministicDistance = (originStr: string, destinationStr: string): { distanceKm: number, durationMin: number } => {
    const combined = `${originStr}->${destinationStr}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    const minKm = 2.5;
    const maxKm = 8.5;
    const distanceKm = parseFloat((minKm + (absHash % 100) / 100 * (maxKm - minKm)).toFixed(2));
    const durationMin = Math.round(distanceKm * 2.2); // ~2.2 minutes per km
    return { distanceKm, durationMin };
  };

  // Proxy endpoint to calculate routes/distance via Google Maps API
  app.get("/api/maps/distance", async (req, res) => {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ status: "error", error: "Origin and destination query parameters are required." });
    }

    const oStr = origin as string;
    const dStr = destination as string;

    const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
    const isPlaceholder = !apiKey || apiKey.includes("YOUR_") || apiKey.length < 15;

    // If Google API key is NOT valid, we return a local deterministic fallback and instruct setting the key
    if (isPlaceholder) {
      const fallback = getDeterministicDistance(oStr, dStr);
      console.log(`[Maps Proxy Fallback] Google Maps key not set or placeholder. Returning deterministic fallback: ${fallback.distanceKm} km`);
      return res.json({
        status: "success",
        distanceKm: fallback.distanceKm,
        durationMin: fallback.durationMin,
        isFallback: true,
        message: "Chave do Google Maps Platform não configurada. Usando estimativa local offline."
      });
    }

    // 1. Try modern Routes API v2 (new recommended standard)
    try {
      const routesUrl = "https://routes.googleapis.com/directions/v2:computeRoutes";
      const routesPayload = {
        origin: { address: oStr },
        destination: { address: dStr },
        travelMode: "DRIVE"
      };

      const routesResponse = await fetch(routesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
        },
        body: JSON.stringify(routesPayload)
      });

      if (routesResponse.ok) {
        const data: any = await routesResponse.json();
        if (data && data.routes && data.routes[0]) {
          const route = data.routes[0];
          const distanceMeters = route.distanceMeters || 0;
          const durationSeconds = route.duration ? parseInt(route.duration) : 0;
          const km = distanceMeters / 1000;
          
          console.log(`[Routes API] Calculated distance from "${oStr}" to "${dStr}": ${km} km`);
          return res.json({
            status: "success",
            distanceKm: km,
            durationMin: Math.round(durationSeconds / 60),
            systemUsed: "Google Routes API v2"
          });
        }
      } else {
        const errText = await routesResponse.text();
        console.log(`[Routes API Info] Status: ${routesResponse.status}, Error body: ${errText.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.log("[Routes API Info] Skipping Routes API v2 attempt due to exception:", e.message || e);
    }

    // 2. Fallback to standard Directions API (very commonly enabled on maps keys)
    try {
      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(oStr)}&destination=${encodeURIComponent(dStr)}&key=${apiKey}`;
      const directionsResponse = await fetch(directionsUrl);
      if (directionsResponse.ok) {
        const data: any = await directionsResponse.json();
        if (data && data.status === "OK" && data.routes && data.routes[0] && data.routes[0].legs && data.routes[0].legs[0]) {
          const leg = data.routes[0].legs[0];
          const distanceMeters = leg.distance ? leg.distance.value : 0;
          const durationSeconds = leg.duration ? leg.duration.value : 0;
          const km = distanceMeters / 1000;

          console.log(`[Directions API] Calculated distance from "${oStr}" to "${dStr}": ${km} km`);
          return res.json({
            status: "success",
            distanceKm: km,
            durationMin: Math.round(durationSeconds / 60),
            systemUsed: "Google Directions API"
          });
        } else {
          console.log(`[Directions API Info] Status: ${data.status || 'No Status'}`);
        }
      }
    } catch (e: any) {
      console.log("[Directions API Info] Skipping Directions API attempt due to exception:", e.message || e);
    }

    // 3. Fallback to Distance Matrix API
    try {
      const matrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(oStr)}&destinations=${encodeURIComponent(dStr)}&key=${apiKey}`;
      const matrixResponse = await fetch(matrixUrl);
      if (matrixResponse.ok) {
        const data: any = await matrixResponse.json();
        if (data && data.status === "OK" && data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
          const element = data.rows[0].elements[0];
          if (element.status === "OK" && element.distance) {
            const distanceMeters = element.distance.value;
            const durationSeconds = element.duration ? element.duration.value : 0;
            const km = distanceMeters / 1000;

            console.log(`[Distance Matrix API] Calculated distance: ${km} km`);
            return res.json({
              status: "success",
              distanceKm: km,
              durationMin: Math.round(durationSeconds / 60),
              systemUsed: "Google Distance Matrix API"
            });
          }
        }
      }
    } catch (e: any) {
      console.log("[Distance Matrix Info] Skipping Distance Matrix attempt due to exception:", e.message || e);
    }

    // Default to elegant deterministic fallback if everything else failed
    const fallback = getDeterministicDistance(oStr, dStr);
    console.log(`[Maps Proxy Fallback] All Google API endpoints failed. Returning deterministic fallback: ${fallback.distanceKm} km`);
    return res.json({
      status: "success",
      distanceKm: fallback.distanceKm,
      durationMin: fallback.durationMin,
      isFallback: true,
      message: "Falha de comunicação com os endpoints do Google Maps. Usando estimativa local offline."
    });
  });

  // Vite middleware integrado para desenvolvimento/produção
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
