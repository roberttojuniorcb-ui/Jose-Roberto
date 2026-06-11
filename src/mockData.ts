import { Cliente, Quadrante } from './types';

export const INITIAL_MOTOBOYS = [
  {
    id: "MOTO-01",
    nome: "Marcos Passos Silva",
    telefone: "(35) 99812-3401",
    cidade: "Passos - MG",
    senha: "passos2026",
    valorRepasseFixo: 4.00,
    empresaExclusiva: "BARROS AUTOPEÇAS",
    criadoEm: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    veiculo: "Moto"
  },
  {
    id: "MOTO-02",
    nome: "Carlos Eduardo Henrique",
    telefone: "(35) 99703-9922",
    cidade: "Passos - MG",
    senha: "passos2026",
    valorRepasseFixo: 4.00,
    empresaExclusiva: "MARIA ANDRADE",
    criadoEm: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    veiculo: "Moto"
  },
  {
    id: "MOTO-03",
    nome: "João Gabriel Souza",
    telefone: "(19) 99402-8811",
    cidade: "Santa Cruz das Palmeiras",
    senha: "santa2026",
    valorRepasseFixo: 5.50,
    empresaExclusiva: "BARROS AUTOPEÇAS",
    criadoEm: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    veiculo: "Moto"
  },
  {
    id: "MOTO-04",
    nome: "Alexandre Lima Rezende",
    telefone: "(19) 99311-2244",
    cidade: "Santa Cruz das Palmeiras",
    senha: "santa2026",
    valorRepasseFixo: 5.50,
    empresaExclusiva: "MARIA ANDRADE",
    criadoEm: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    veiculo: "Moto"
  }
];

export function getInitialClientes(): Cliente[] {
  return [
    {
      id: "CLI-BARROS",
      nome: "BARROS AUTOPEÇAS",
      quadrante: "A",
      endereco: "Av. Arnaldo Byrd, 1420 - Centro",
      telefone: "(35) 3521-9988",
      cidade: "Passos - MG",
      cep: "37900-010",
      valorPagoMotoboy: 4.00,
      valorCobradoCliente: 10.00,
      senha: "cliente123", // default fallback password
      email: "contato@barrosautopecas.com.br",
      emailConfirmado: true,
      cadastroCompleto: true,
      cnpj: "12.345.678/0001-90",
      inscricaoEstadual: "123.456.789.110",
      ramo: "Autopeças",
      criadoPor: "Empresa",
      criadoEm: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: "CLI-MARIA",
      nome: "MARIA ANDRADE",
      quadrante: "B",
      endereco: "Rua Maria Rezende, 88 - Muarama",
      telefone: "(35) 99887-1122",
      cidade: "Passos - MG",
      cep: "37902-120",
      valorPagoMotoboy: 4.00,
      valorCobradoCliente: 10.00,
      senha: "cliente123",
      email: "contato@mariaandrade.com.br",
      emailConfirmado: true,
      cadastroCompleto: true,
      cnpj: "98.765.432/0001-01",
      inscricaoEstadual: "987.654.321.110",
      ramo: "Autopeças",
      criadoPor: "Empresa",
      criadoEm: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
    }
  ];
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
