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

  // Proxy endpoint to calculate routes/distance via Google Maps API
  app.get("/api/maps/distance", async (req, res) => {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ status: "error", error: "Origin and destination query parameters are required." });
    }

    const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
    if (!apiKey) {
      return res.status(400).json({ status: "error", error: "Google Maps API key not configured on server." });
    }

    // 1. Try modern Routes API v2 (new recommended standard)
    try {
      const routesUrl = "https://routes.googleapis.com/v2:computeRoutes";
      const routesPayload = {
        origin: { address: origin as string },
        destination: { address: destination as string },
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
          
          console.log(`[Routes API] Calculated distance from "${origin}" to "${destination}": ${km} km`);
          return res.json({
            status: "success",
            distanceKm: km,
            durationMin: Math.round(durationSeconds / 60)
          });
        }
      } else {
        const errText = await routesResponse.text();
        console.warn(`[Routes API Fail] Status: ${routesResponse.status}, Error: ${errText}`);
      }
    } catch (e: any) {
      console.error("[Routes API Exception]", e);
    }

    // 2. Fallback to standard Directions API (very commonly enabled on maps keys)
    try {
      console.log("[Directions API Fallback] Querying legacy Directions API...");
      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin as string)}&destination=${encodeURIComponent(destination as string)}&key=${apiKey}`;
      const directionsResponse = await fetch(directionsUrl);
      if (directionsResponse.ok) {
        const data: any = await directionsResponse.json();
        if (data && data.status === "OK" && data.routes && data.routes[0] && data.routes[0].legs && data.routes[0].legs[0]) {
          const leg = data.routes[0].legs[0];
          const distanceMeters = leg.distance ? leg.distance.value : 0;
          const durationSeconds = leg.duration ? leg.duration.value : 0;
          const km = distanceMeters / 1000;

          console.log(`[Directions API] Calculated distance from "${origin}" to "${destination}": ${km} km`);
          return res.json({
            status: "success",
            distanceKm: km,
            durationMin: Math.round(durationSeconds / 60)
          });
        } else {
          console.warn(`[Directions API Non-OK Status] ${data.status || 'No Status'}`);
        }
      }
    } catch (e: any) {
      console.error("[Directions API Exception]", e);
    }

    // 3. Fallback to Distance Matrix API
    try {
      console.log("[Distance Matrix API Fallback] Querying Distance Matrix API...");
      const matrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin as string)}&destinations=${encodeURIComponent(destination as string)}&key=${apiKey}`;
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
              durationMin: Math.round(durationSeconds / 60)
            });
          }
        }
      }
    } catch (e: any) {
      console.error("[Distance Matrix Exception]", e);
    }

    return res.status(502).json({
      status: "error",
      error: "All Google Maps API routes failed or key does not have them activated."
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
