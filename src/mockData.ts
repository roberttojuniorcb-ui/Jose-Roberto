import { Cliente, Quadrante } from './types';

// Helper to generate distinct realistic auto mechanics and workshops
const WORKSHOP_NAMES = [
  "Autopeças", "Distribuidora de Peças", "Auto Peças Importadas", "Moto Peças", 
  "Distribuidora Regional", "Central Autopeças B2B", "Líder Auto Peças", "Geral Peças",
  "Mercado de Peças", "Filtros & Correias", "Auto Peças & Distribuição", "Vale Autopeças", "Império Peças"
];

const PATRON_NAMES = [
  "Moreira", "Souza", "Renan", "Ferreira", "Oliveira", "Gomes", "Almeida",
  "Rodrigues", "Marcondes", "Mendes", "Pires", "Silva", "Cardoso", "Vargas",
  "Carvalho", "Borges", "Geronimo", "Nakamura", "Carvalho", "Batista", "Lopes"
];

const STREETS = [
  "Av. República do Líbano", "Rua General Osório", "Av. Francisco Glicério",
  "Rua Voluntários da Pátria", "Av. dos Autistas", "Rua das Autopeças",
  "Av. Dom Pedro II", "Rua Marechal Deodoro", "Av. Brigadeiro Luis Antônio",
  "Rua João Cachoeira", "Av. Professor Francisco Morato", "Av. Santo Amaro",
  "Rua Clélia", "Av. Celso Garcia", "Av. Jabaquara", "Rua Dr. Zuquim"
];

function generateRealisticClient(idNum: number, quadrante: Quadrante): Cliente {
  const prefix = WORKSHOP_NAMES[idNum % WORKSHOP_NAMES.length];
  const patron = PATRON_NAMES[(idNum * 3) % PATRON_NAMES.length];
  const street = STREETS[(idNum * 7) % STREETS.length];
  const num = 120 + (idNum * 14) % 1500;
  
  // Distribute across Passos - MG and Belo Horizonte - MG
  const isPassos = idNum % 3 !== 0; // 2/3 of clients in Passos - MG as requested by user
  const cidade = isPassos ? "Passos - MG" : "Belo Horizonte - MG";
  const valorPagoMotoboy = isPassos ? 4.00 : 5.50;
  const valorCobradoCliente = isPassos ? 10.00 : 13.00;

  return {
    id: `CLI-${quadrante}-${1000 + idNum}`,
    nome: `${prefix} ${patron} #${idNum}`,
    quadrante,
    endereco: `${street}, ${num} - Quadrante ${quadrante}`,
    telefone: `(11) 9${3000 + (idNum * 11) % 5000}-${4000 + (idNum * 17) % 5000}`,
    cidade,
    valorPagoMotoboy,
    valorCobradoCliente,
    senha: "cliente123",
    email: `oficina${idNum % 100}@torqueteste.com.br`,
    emailConfirmado: true,
    cadastroCompleto: true,
    criadoPor: idNum % 5 === 0 ? 'Entregador' : 'Empresa',
    criadoEm: new Date(Date.now() - (idNum * 3600000)).toISOString(),
    motoboysAtivos: (idNum % 4) + 1
  };
}

export const INITIAL_MOTOBOYS = [
  {
    id: "MOTO-01",
    nome: "Marcos Passos Silva",
    telefone: "(35) 99812-3401",
    cidade: "Passos - MG",
    senha: "passos123",
    valorRepasseFixo: 4.00,
    criadoEm: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "MOTO-02",
    nome: "Carlos Eduardo Henrique",
    telefone: "(35) 99703-9922",
    cidade: "Passos - MG",
    senha: "passos123",
    valorRepasseFixo: 4.00,
    criadoEm: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "MOTO-03",
    nome: "João Gabriel Souza",
    telefone: "(31) 99402-8811",
    cidade: "Belo Horizonte - MG",
    senha: "bh123",
    valorRepasseFixo: 5.50,
    criadoEm: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  }
];

// Ensure each of the 6 quadrants has exactly 22 preloaded active clients (>20 clients)
export function getInitialClientes(): Cliente[] {
  const list: Cliente[] = [];
  const quadrantes: Quadrante[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  
  quadrantes.forEach(q => {
    for (let i = 1; i <= 22; i++) {
      list.push(generateRealisticClient(i, q));
    }
  });
  
  return list;
}

export const AUTO_PECA_SUGESTOES = [
  "2x Amortecedores Traseiros Cofap LE",
  "1x Jogo de Pastilhas de Freio Fras-le LD",
  "4x Filtros de Óleo Tecfil cx",
  "1x Radiador de Água Valeo - Volumoso",
  "2x Amortecedores Dianteiros Monroe (LD+LE) [Pesado]",
  "3x Filtros de Combustível + 1x Jogo de Pastilhas Traseiras",
  "1x Radiador + 2x Jogos de Pastilhas Dianteiras",
  "1x Terminal de Direção Nakata + 2x Cabos de Vela",
  "5x Filtros de Ar Fram (cx de 5 un)",
  "4x Amortecedores Cofap (Kit Completo LD+LE) - Bloqueio Cubagem"
];
