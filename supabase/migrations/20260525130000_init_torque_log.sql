-- Supabase Migration: Init TorqueLog Database Schema
-- Timestamp: 2026-05-25 13:00:00
-- Description: Creates schemas, constraints, indexes, RLS policies, and triggers for TorqueLog delivery control.

-- 1. Create Enums / Domains
CREATE TYPE quadrante_type AS ENUM ('A', 'B', 'C', 'D', 'E', 'F');
CREATE TYPE criado_por_type AS ENUM ('Empresa', 'Entregador');
CREATE TYPE status_ordem_type AS ENUM ('Pendente', 'Buscando Parceiro', 'Moto a Caminho', 'Rota Agrupada', 'Entregue');
CREATE TYPE status_rota_type AS ENUM ('Buscando Parceiro', 'Moto a Caminho', 'Entregue');
CREATE TYPE pecas_tipo_type AS ENUM ('pastilhas', 'filtros', 'amortecedores', 'radiadores', 'cabos', 'outros');

-- 2. Create Clientes Table
CREATE TABLE IF NOT EXISTS public.clientes (
    id VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    quadrante Public.quadrante_type NOT NULL DEFAULT 'A',
    endereco TEXT NOT NULL,
    telefone VARCHAR(50) NOT NULL,
    cidade VARCHAR(100) NOT NULL DEFAULT 'Passos - MG',
    valor_pago_motoboy NUMERIC(10, 2) NOT NULL DEFAULT 4.00,
    valor_cobrado_cliente NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    senha VARCHAR(255) DEFAULT 'cliente123',
    email VARCHAR(255),
    email_confirmado BOOLEAN NOT NULL DEFAULT FALSE,
    cadastro_completo BOOLEAN NOT NULL DEFAULT FALSE,
    cnpj VARCHAR(50),
    inscricao_estadual VARCHAR(50),
    criado_por Public.criado_por_type NOT NULL DEFAULT 'Empresa',
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Motoboys Table (Entregadores)
CREATE TABLE IF NOT EXISTS public.motoboys (
    id VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(50) NOT NULL,
    cidade VARCHAR(100) NOT NULL DEFAULT 'Passos - MG',
    senha VARCHAR(255) NOT NULL DEFAULT 'passos123',
    valor_repasse_fixo NUMERIC(10, 2) NOT NULL DEFAULT 4.00,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Rotas Agrupadas Table
CREATE TABLE IF NOT EXISTS public.rotas_agrupadas (
    id VARCHAR(50) PRIMARY KEY,
    quadrante Public.quadrante_type NOT NULL DEFAULT 'A',
    ordens_ids TEXT[] NOT NULL DEFAULT '{}',
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    status Public.status_rota_type NOT NULL DEFAULT 'Buscando Parceiro',
    itens_agrupados TEXT[] NOT NULL DEFAULT '{}',
    motociclista_atribuido VARCHAR(50) REFERENCES public.motoboys(id) ON DELETE SET NULL
);

-- 5. Create Ordens de Serviço (OrdemServico)
CREATE TABLE IF NOT EXISTS public.ordens_servico (
    id VARCHAR(50) PRIMARY KEY,
    cliente_id VARCHAR(50) REFERENCES public.clientes(id) ON DELETE RESTRICT,
    cliente_nome VARCHAR(255) NOT NULL,
    quadrante Public.quadrante_type NOT NULL DEFAULT 'A',
    itens_descricao TEXT NOT NULL,
    itens_analistas JSONB NOT NULL DEFAULT '[]'::jsonb,
    endereco_entrega TEXT,
    destinatario_nome VARCHAR(255),
    retorno_peca BOOLEAN NOT NULL DEFAULT FALSE,
    taxa_reversa NUMERIC(10, 2) DEFAULT 0.00,
    valor_pago_motoboy NUMERIC(10, 2) NOT NULL DEFAULT 4.00,
    valor_cobrado_cliente NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    motoboy_id VARCHAR(50) REFERENCES public.motoboys(id) ON DELETE SET NULL,
    motoboy_nome VARCHAR(255),
    status Public.status_ordem_type NOT NULL DEFAULT 'Pendente',
    grupo_rota_id VARCHAR(50) REFERENCES public.rotas_agrupadas(id) ON DELETE SET NULL,
    motivo_desmembramento TEXT,
    trava_cubagem_status VARCHAR(100) NOT NULL DEFAULT 'Liberado - Cabe no Baú',
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indices for Speed and Optimization
CREATE INDEX IF NOT EXISTS idx_clientes_quadrante ON public.clientes(quadrante);
CREATE INDEX IF NOT EXISTS idx_clientes_cidade ON public.clientes(cidade);
CREATE INDEX IF NOT EXISTS idx_ordens_cliente_id ON public.ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_status ON public.ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordens_quadrante ON public.ordens_servico(quadrante);
CREATE INDEX IF NOT EXISTS idx_ordens_grupo_rota ON public.ordens_servico(grupo_rota_id);
CREATE INDEX IF NOT EXISTS idx_rotas_status ON public.rotas_agrupadas(status);

-- 7. Enable Row Level Security (RLS) but allow anonymous access for simpler visual integrations, or edit policies as requested
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motoboys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas_agrupadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

-- 8. Policies (Create simple permissive policies for development and full sync capability)
CREATE POLICY "Allow public select of clientes" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "Allow public insert of clientes" ON public.clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of clientes" ON public.clientes FOR UPDATE USING (true);

CREATE POLICY "Allow public select of motoboys" ON public.motoboys FOR SELECT USING (true);
CREATE POLICY "Allow public insert of motoboys" ON public.motoboys FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of motoboys" ON public.motoboys FOR UPDATE USING (true);

CREATE POLICY "Allow public select of rotas" ON public.rotas_agrupadas FOR SELECT USING (true);
CREATE POLICY "Allow public insert of rotas" ON public.rotas_agrupadas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of rotas" ON public.rotas_agrupadas FOR UPDATE USING (true);

CREATE POLICY "Allow public select of ordens" ON public.ordens_servico FOR SELECT USING (true);
CREATE POLICY "Allow public insert of ordens" ON public.ordens_servico FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of ordens" ON public.ordens_servico FOR UPDATE USING (true);

-- 9. Insert Seed Data for Motoboys
INSERT INTO public.motoboys (id, nome, telefone, cidade, senha, valor_repasse_fixo, criado_em)
VALUES 
('MOTO-01', 'Marcos Passos Silva', '(35) 99812-3401', 'Passos - MG', 'passos123', 4.00, NOW() - INTERVAL '30 days'),
('MOTO-02', 'Carlos Eduardo Henrique', '(35) 99703-9922', 'Passos - MG', 'passos123', 4.00, NOW() - INTERVAL '15 days'),
('MOTO-03', 'João Gabriel Souza', '(31) 99402-8811', 'Belo Horizonte - MG', 'bh123', 5.50, NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;
