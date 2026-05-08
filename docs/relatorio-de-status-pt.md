# MINHA MÁQUINA — Plataforma de Telemetria
## Relatório Técnico de Status e Roadmap
**Data:** 8 de maio de 2026  
**Elaborado por:** 4Safe Tecnologia  
**Destinatário:** NavorTech  

---

## 1. Visão Geral

A plataforma MINHA MÁQUINA é um sistema de telemetria de frota desenvolvido especificamente para os equipamentos Bobcat da NavorTech, rastreados por dispositivos GPS VIRLOC VL06 e VL08. A plataforma cobre toda a cadeia de dados: desde os bytes brutos transmitidos pelos dispositivos em campo, até um painel web acessível pelos operadores de frota.

O sistema está implantado em um servidor VPS de produção no IP **38.247.130.26** e está atualmente em funcionamento.

---

## 2. Arquitetura Resumida

```
[Dispositivo VL06/VL08]
       │  UDP / TCP  porta 6600
       ▼
[Gateway de Ingestão XVM]     ← serviço systemd, sempre ativo
       │  SQL (Drizzle ORM)
       ▼
[PostgreSQL — banco navortech] ← única fonte de verdade
       │  API REST (Express)
       ▼
[minhamaquina-api]            ← processo Node.js gerenciado pelo PM2, porta 4001
       │  Proxy reverso Nginx
       ▼
[Painel MINHA MÁQUINA]        ← SPA React, servido pelo Nginx
       │  HTTPS (navegador)
       ▼
[Operador de Frota]
```

---

## 3. Status Atual — O Que Está Funcionando

### 3.1 Gateway de Ingestão XVM ✅ Saudável

| Propriedade | Valor |
|-------------|-------|
| Nome do serviço | `navortech-gateway.service` |
| Gerenciado por | systemd (reinicia automaticamente no boot do VPS) |
| Protocolo | UDP + TCP na porta 6600 |
| Status | **Ativo / Em execução** |
| Banco de dados | `navortech` (PostgreSQL, localhost) |

O gateway está totalmente operacional. Ele:
- Recebe pacotes de telemetria brutos dos rastreadores VIRLOC VL06/VL08 via UDP e TCP
- Divide e valida os envelopes de quadro `>…<` com verificação de checksum XOR-LRC
- Envia ACK para cada quadro válido originado pelo dispositivo, evitando retransmissões
- Decodifica os tipos de relatório: **RGP** (posição GPS), **RUV00** (snapshot de instalação), **RUV01** (telemetria completa), **RUV02** (fim de viagem), **RUV03** (dados periódicos do motor)
- Persiste cada pacote com trilha de auditoria completa no PostgreSQL (pacotes → quadros → reports_*)
- Atualiza o "estado mais recente" do dispositivo (posição, velocidade, horímetro, ignição) a cada relatório recebido
- Lida com fragmentação de stream TCP e rollover de número de mensagem de 16 bits
- Deduplica quadros retransmitidos usando bloqueios de transação advisory

**Atividade dos dispositivos em campo (hoje):**

| Dispositivo | Último Contato | Transporte | Horímetro |
|-------------|---------------|------------|-----------|
| PFDU | 08/05/2026 10:35 UTC | UDP | 5.328 min |
| PNMB | 29/04/2026 14:44 UTC | UDP | — |

O PFDU está transmitindo ativamente. O PNMB não foi visto desde 29 de abril — provavelmente desligado ou sem cobertura móvel em campo.

### 3.2 Banco de Dados ✅

| Propriedade | Valor |
|-------------|-------|
| Motor | PostgreSQL (localhost) |
| Nome do banco | `navortech` |
| Tabelas | `devices`, `packets`, `frames`, `reports_rgp`, `reports_ruv00–03`, `mm_users` |

O esquema do banco espelha o pipeline de decodificação do protocolo. Os índices estão otimizados para consultas de "relatório mais recente por dispositivo" e agregações por janela de tempo em toda a frota.

### 3.3 API REST ✅

| Propriedade | Valor |
|-------------|-------|
| Framework | Express 5 |
| Gerenciador de processos | PM2 (`minhamaquina-api`) |
| Porta | 4001 (interna, via proxy Nginx) |
| Autenticação | Login email + senha → JWT (sessão de 7 dias) |

Principais endpoints:
- `GET /api/healthz` — verificação de disponibilidade (público)
- `POST /api/auth/login` — emite JWT
- `GET /api/devices` — lista de dispositivos da frota com telemetria mais recente
- `GET /api/devices/:id` — detalhes do dispositivo com pacotes e relatórios paginados
- `GET /api/devices/:id/packets` — histórico de pacotes
- `GET /api/devices/:id/reports/rgp` — histórico de relatórios GPS
- `GET /api/devices/:id/reports/ruv00–03` — histórico de relatórios tipados

### 3.4 Painel de Controle (Dashboard) ✅

| Propriedade | Valor |
|-------------|-------|
| Tecnologia | React + Vite (SPA) |
| Servido por | Nginx (arquivos estáticos) |
| URL atual | http://38.247.130.26 |
| Idiomas | Português (padrão) / Inglês |
| Temas | Dark Navy, Dark Amber, Claro |

Páginas do painel:
- **Visão Geral da Frota** — 5 cards de KPIs (máquinas ativas, saúde do sistema, total de horas da frota, status de manutenção) + lista de máquinas + mapa ao vivo + feed de pacotes
- **Equipamentos** — grade com todas as máquinas, estatísticas por dispositivo e badges de status
- **Manutenção** — tabela de acompanhamento de ciclo de 500 horas; status vencido / próximo / normal por máquina
- **Detalhe do Dispositivo** — layout de 7 abas: Pacotes, GPS/RGP, Street View, RUV00, RUV01, RUV02, RUV03
- **Street View** — panorama Google Maps Street View na última posição GPS conhecida do dispositivo

### 3.5 Contas de Usuário ✅

| E-mail | Função |
|--------|--------|
| `admin@minhamaquina.com` | Administrador |
| `pharrell.chatupa@4safetecnologia.com` | Operador |

---

## 4. Roadmap — O Que Precisa Ser Feito a Seguir

### 4.1 Nome de Domínio (Prioridade: Alta)
**Situação atual:** A plataforma está acessível apenas pelo IP bruto (`http://38.247.130.26`).  
**Ação necessária:** Um domínio deve ser apontado para este servidor. Opções:
- `minhamaquina.navortech.com.br` (subdomínio NavorTech)
- `minhamaquina.4safetecnologia.com` (subdomínio 4Safe)
- Um domínio dedicado (ex.: `minhamaquina.com.br`)

A NavorTech ou o registrador do domínio precisa criar um **registro A** apontando para `38.247.130.26`. Após a propagação (geralmente em minutos), o passo 4.2 pode ser executado imediatamente.

### 4.2 Certificado SSL/TLS — HTTPS (Prioridade: Alta)
**Situação atual:** O tráfego é HTTP sem criptografia. As credenciais de login são transmitidas em texto puro.  
**Ação necessária:** Emitir um certificado gratuito Let's Encrypt via Certbot. O processo leva aproximadamente 5 minutos após o domínio estar ativo.

Comando a executar no VPS:
```bash
sudo certbot --nginx -d minhamaquina.navortech.com.br
```

Isso irá automaticamente:
- Emitir e instalar o certificado TLS
- Atualizar a configuração do Nginx para servir HTTPS na porta 443
- Adicionar redirecionamento de HTTP → HTTPS
- Agendar a renovação automática do certificado

### 4.3 Investigação do Dispositivo PNMB (Prioridade: Média)
**Situação atual:** O dispositivo PNMB não transmite desde 29 de abril de 2026.  
**Ação necessária:** Investigação em campo para confirmar se a unidade está:
- Desligada / equipamento fora de uso
- Com problema no chip SIM ou na cobertura móvel
- Com falha de hardware no módulo VL06/VL08

Se o dispositivo estiver operacional, o gateway irá captar automaticamente as transmissões sem nenhuma alteração de configuração.

### 4.4 Atualização Automática do Painel (Prioridade: Média)
**Situação atual:** Os dados do painel são carregados na abertura da página e exigem atualização manual do navegador para exibir novos pacotes.  
**Ação necessária:** Implementar Server-Sent Events (SSE) ou WebSocket para que a visão geral da frota e as páginas de detalhe do dispositivo se atualizem automaticamente conforme novos pacotes chegam do campo.

### 4.5 Token de API para Acesso Programático (Prioridade: Baixa)
**Situação atual:** A API aceita JWT (via login) ou uma variável de ambiente estática `API_READ_TOKEN`.  
**Ação necessária:** Configurar um `API_READ_TOKEN` robusto no PM2 do VPS caso a NavorTech precise de acesso máquina-a-máquina (ex.: integração com ERP ou sistemas de relatórios).

### 4.6 Monitoramento e Alertas (Prioridade: Baixa)
**Situação atual:** PM2 e systemd oferecem recuperação básica de falhas, mas não há alertas proativos.  
**Adições recomendadas:**
- Monitor de uptime (ex.: UptimeRobot) no endpoint `https://[domínio]/api/healthz`
- Alerta quando um dispositivo não é visto por mais de 24 horas
- Alerta em caso de taxa elevada de erros de parse no gateway

### 4.7 Estratégia de Backup (Prioridade: Baixa)
**Situação atual:** Nenhum backup automático do banco de dados configurado.  
**Ação necessária:** Agendar `pg_dump` noturno do banco `navortech` para um local remoto seguro (S3, Backblaze ou SFTP).

---

## 5. Tabela Resumo

| Item | Status | Próxima Ação |
|------|--------|--------------|
| Gateway (ingestão VL06/VL08) | ✅ Ativo | Nenhuma — saudável |
| Banco de dados (PostgreSQL) | ✅ Ativo | Nenhuma |
| API REST | ✅ Ativo | Configurar API_READ_TOKEN se necessário |
| Painel de controle | ✅ Ativo | Nenhuma |
| Contas de usuário | ✅ Criadas | Adicionar mais conforme necessário |
| Dispositivo PFDU | ✅ Ativo | Nenhuma |
| Dispositivo PNMB | ⚠️ Offline desde 29/04 | Investigação em campo |
| Nome de domínio | ❌ Não configurado | NavorTech criar registro A no DNS |
| HTTPS / SSL | ❌ Não configurado | Certbot após domínio ativo |
| Atualização automática do painel | ❌ Não implementado | Funcionalidade planejada |
| Monitoramento | ❌ Não configurado | Recomendado |
| Backup do banco de dados | ❌ Não configurado | Recomendado |

---

## 6. Contato

Para dúvidas técnicas sobre esta plataforma, entre em contato com:  
**4Safe Tecnologia** — pharrell.chatupa@4safetecnologia.com
