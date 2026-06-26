import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { OrdemServico, Cliente, Motoboy } from "../types";

interface PDFParams {
  role: 'Empresa' | 'Cliente' | 'Motoboy';
  periodText: string;
  activeCliente?: Cliente | null;
  activeMotoboy?: Motoboy | null;
  ordens: OrdemServico[];
  allClientes: Cliente[];
  allMotoboys: Motoboy[];
}

export function exportFechamentoPDF({
  role,
  periodText,
  activeCliente,
  activeMotoboy,
  ordens,
  allClientes,
  allMotoboys
}: PDFParams) {
  // 1. Initialize jsPDF
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  // Colors
  const brandOrange = [249, 115, 22]; // #f97316 (Primary)
  const brandDark = [15, 23, 42]; // #0f172a (Slate-900)
  const brandGray = [71, 85, 105]; // #475569 (Slate-600)
  const lightGray = [241, 245, 249]; // #f1f5f9 (Slate-100)
  const borderGray = [226, 232, 240]; // #e2e8f0 (Slate-200)

  // 2. Decorative Top bar
  doc.setFillColor(brandOrange[0], brandOrange[1], brandOrange[2]);
  doc.rect(0, 0, pageWidth, 5, "F");

  // 3. Header Segment
  // Draw minimalist Logo Icon "TorqueLog" (Two geometric orange circles/arrows representation)
  doc.setFillColor(brandOrange[0], brandOrange[1], brandOrange[2]);
  doc.circle(20, 18, 5, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(20, 18, 2.5, "F");
  doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.rect(21, 16.5, 3, 3, "F");

  // Company Name
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TorqueLog", 28, 19);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(brandOrange[0], brandOrange[1], brandOrange[2]);
  doc.text("LOGÍSTICA INTELIGENTE B2B", 28, 23);

  // Document metadata (Top Right)
  doc.setTextColor(brandGray[0], brandGray[1], brandGray[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`CÓDIGO CONTROLE: TL-${Math.floor(100000 + Math.random() * 900000)}`, pageWidth - 80, 15);
  doc.text(`GERADO EM: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - 80, 19);
  doc.text(`SITUAÇÃO DO FECHAMENTO: CONSOLIDADO`, pageWidth - 80, 23);

  // Line Separator
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.5);
  doc.line(15, 28, pageWidth - 15, 28);

  // 4. Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text("DEMONSTRATIVO DE FECHAMENTO FINANCEIRO E FISCAL", 15, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(brandGray[0], brandGray[1], brandGray[2]);
  doc.text(`Período de Apuração: ${periodText}`, 15, 41);

  // 5. Partner / Entity Profile Information Frame
  let targetProfileName = "";
  let targetProfileDocument = "";
  let targetProfileContact = "";
  let targetProfileLocation = "";
  let targetProfileEmail = "";

  if (role === 'Cliente') {
    targetProfileName = activeCliente?.nome || "Cliente Parceiro";
    targetProfileDocument = activeCliente?.cnpj ? `CNPJ: ${activeCliente.cnpj}` : "CNPJ: Não cadastrado";
    targetProfileContact = `Telefone: ${activeCliente?.telefone || "Não informado"}`;
    targetProfileLocation = `Cidade: ${activeCliente?.cidade || "Não informada"} | Setor Logístico: ${activeCliente?.quadrante || "N/A"}`;
    targetProfileEmail = `E-mail: ${activeCliente?.email || "Não informado"}`;
  } else if (role === 'Motoboy') {
    targetProfileName = activeMotoboy?.nome || "Motoboy Parceiro MEI";
    targetProfileDocument = `Credenciado MEI | CPF/CNPJ: ${activeMotoboy?.placaAtual ? "Veículo Placa " + activeMotoboy.placaAtual : "Entregador Parceiro"}`;
    targetProfileContact = `Telefone: ${activeMotoboy?.telefone || "Não informado"}`;
    targetProfileLocation = `Cidade de Atuação: ${activeMotoboy?.cidade || "Não informada"} | Veículo: ${activeMotoboy?.veiculo || "Motos"}`;
    targetProfileEmail = `Status: Contrato Autônomo MEI`;
  } else {
    targetProfileName = "torqueLog Logística Inteligente Ltda";
    targetProfileDocument = "CNPJ: 45.013.517/0001-90";
    targetProfileContact = "Telefone: (19) 98442-7748";
    targetProfileLocation = "Cidade de Operações: Passos - MG";
    targetProfileEmail = "E-mail: contato@torquelog.com.br";
  }

  // Draw Profile Box Frame
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.roundedRect(15, 45, pageWidth - 30, 26, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(brandOrange[0], brandOrange[1], brandOrange[2]);
  doc.text("DADOS DO PARCEIRO / TITULAR DO FECHAMENTO", 19, 51);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text(targetProfileName, 19, 57);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text(targetProfileDocument, 19, 62);
  doc.text(targetProfileContact, 19, 66);

  doc.text(targetProfileLocation, 105, 57);
  doc.text(targetProfileEmail, 105, 62);
  doc.text(`Status do Cadastro: Credenciado / Homologado`, 105, 66);

  // 6. Values and Aggregations Summary Rows
  let totalBilledToClients = 0;
  let totalOwedToMotoboys = 0;

  ordens.forEach(o => {
    totalBilledToClients += (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0);
    totalOwedToMotoboys += (o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0);
  });

  const totalProfit = totalBilledToClients - totalOwedToMotoboys;
  const totalCount = ordens.length;

  // Render bento-grid summaries
  const boxY = 75;
  const boxH = 18;
  if (role === 'Empresa') {
    // 4 columns
    const colW = (pageWidth - 30) / 4;

    // Qtd
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, boxY, colW - 2, boxH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(brandGray[0], brandGray[1], brandGray[2]);
    doc.text("ENTREGAS CONCLUÍDAS", 18, boxY + 5);
    doc.setFontSize(11);
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text(`${totalCount} ordens`, 18, boxY + 12);

    // Faturado Clientes
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(15 + colW, boxY, colW - 2, boxH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229);
    doc.text("FATURADO CLIENTES B2B", 15 + colW + 3, boxY + 5);
    doc.setFontSize(11);
    doc.setTextColor(49, 46, 129);
    doc.text(`R$ ${totalBilledToClients.toFixed(2)}`, 15 + colW + 3, boxY + 12);

    // Repassar
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(15 + colW * 2, boxY, colW - 2, boxH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(220, 38, 38);
    doc.text("REPASSE A MOTOBOYS", 15 + colW * 2 + 3, boxY + 5);
    doc.setFontSize(11);
    doc.setTextColor(153, 27, 27);
    doc.text(`R$ ${totalOwedToMotoboys.toFixed(2)}`, 15 + colW * 2 + 3, boxY + 12);

    // Lucro
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(15 + colW * 3, boxY, colW, boxH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(5, 150, 105);
    doc.text("LUCRO BRUTO OPERACIONAL", 15 + colW * 3 + 3, boxY + 5);
    doc.setFontSize(11);
    doc.setTextColor(6, 78, 59);
    doc.text(`R$ ${totalProfit.toFixed(2)}`, 15 + colW * 3 + 3, boxY + 12);

  } else if (role === 'Cliente') {
    // 2 columns
    const colW = (pageWidth - 30) / 2;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, boxY, colW - 2, boxH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(brandGray[0], brandGray[1], brandGray[2]);
    doc.text("ENTREGAS CONCLUÍDAS NO PERÍODO", 18, boxY + 6);
    doc.setFontSize(11);
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text(`${totalCount} fretes finalizados`, 18, boxY + 13);

    doc.setFillColor(236, 253, 245);
    doc.roundedRect(15 + colW, boxY, colW, boxH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(5, 150, 105);
    doc.text("CUSTO TOTAL DE FATURAMENTO (A PAGAR)", 15 + colW + 4, boxY + 6);
    doc.setFontSize(12);
    doc.setTextColor(6, 78, 59);
    doc.text(`R$ ${totalBilledToClients.toFixed(2)}`, 15 + colW + 4, boxY + 13);

  } else {
    // Motoboy
    const colW = (pageWidth - 30) / 2;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, boxY, colW - 2, boxH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(brandGray[0], brandGray[1], brandGray[2]);
    doc.text("TOTAL DE CORRIDAS REALIZADAS", 18, boxY + 6);
    doc.setFontSize(11);
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text(`${totalCount} serviços finalizados`, 18, boxY + 13);

    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15 + colW, boxY, colW, boxH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(217, 119, 6);
    doc.text("REPASSE TOTAL A RECEBER (CRÉDITO)", 15 + colW + 4, boxY + 6);
    doc.setFontSize(12);
    doc.setTextColor(146, 64, 14);
    doc.text(`R$ ${totalOwedToMotoboys.toFixed(2)}`, 15 + colW + 4, boxY + 13);
  }

  // 8. AutoTable containing orders detail
  const tableData = ordens.map(o => {
    const val = role === 'Cliente' 
      ? ((o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0))
      : ((o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0));

    const dateFormatted = new Date(o.criadoEm).toLocaleDateString('pt-BR') + ' ' + new Date(o.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Customize columns based on who's looking at it
    return [
      o.id,
      dateFormatted,
      o.clienteNome,
      `Setor ${o.quadrante}`,
      o.motoboyNome || 'Sem atribuição',
      o.itensDescricao,
      o.retornoPeca ? 'Sim (Reversa)' : 'Não',
      `R$ ${val.toFixed(2)}`
    ];
  });

  const tableHeaders = [
    "Cód OS", 
    "Data/Hora", 
    "Cliente B2B", 
    "Setor", 
    "Entregador", 
    "Descrição dos Itens", 
    "Reversa?", 
    "Valor"
  ];

  autoTable(doc, {
    startY: 98,
    head: [tableHeaders],
    body: tableData,
    margin: { left: 15, right: 15 },
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42], // brandDark
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "left"
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [15, 23, 42], cellWidth: 14 },
      1: { cellWidth: 22 },
      2: { cellWidth: 30 },
      3: { cellWidth: 12 },
      4: { cellWidth: 26 },
      5: { cellWidth: 45 },
      6: { cellWidth: 15 },
      7: { halign: "right", fontStyle: "bold", cellWidth: 18 }
    },
    foot: [[
      "TOTAL", 
      "", 
      "", 
      "", 
      "", 
      "", 
      "", 
      role === 'Cliente' ? `R$ ${totalBilledToClients.toFixed(2)}` : `R$ ${totalOwedToMotoboys.toFixed(2)}`
    ]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: "bold",
      halign: "left"
    },
    didDrawPage: (data) => {
      // Add footer for each page
      const pageCount = doc.internal.pages.length - 1;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(brandGray[0], brandGray[1], brandGray[2]);
      doc.text(
        `TorqueLog Logística Inteligente B2B • www.torquelog.com.br • Suporte (19) 98442-7748`, 
        15, 
        pageHeight - 10
      );
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`, 
        pageWidth - 30, 
        pageHeight - 10
      );
    }
  });

  // 9. Signatures Block
  let finalY = (doc as any).lastAutoTable.finalY + 15;
  if (finalY > pageHeight - 45) {
    doc.addPage();
    finalY = 25;
  }

  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.4);
  doc.line(20, finalY + 12, 85, finalY + 12);
  doc.line(125, finalY + 12, 190, finalY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text("TorqueLog Logística Inteligente B2B", 25, finalY + 16);
  doc.text(role === 'Empresa' ? "Auditoria Geral Interna" : targetProfileName, 132, finalY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(brandGray[0], brandGray[1], brandGray[2]);
  doc.text("Assinatura Eletrônica do Responsável", 27, finalY + 19);
  doc.text(role === 'Empresa' ? "Selo de Segurança de Conciliação" : "Assinatura do Parceiro Titular", 135, finalY + 19);

  // 11. Save PDF
  const filename = `Fechamento_${role}_${targetProfileName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
