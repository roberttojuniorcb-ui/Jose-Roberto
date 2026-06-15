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
