# Telemetria de Frota NavorTech — Status do Deploy e Bloqueio Atual

**Preparado por:** Safeon (engenharia contratada, plataforma de propriedade da NavorTech)
**Data:** 29 de abril de 2026
**Servidor:** `38.247.130.26:6600` (VPS operada pela Safeon, dedicada à NavorTech)
**Status:** Gateway totalmente implantado e em escuta. Aguardando uma única alteração de rede no provedor de hospedagem antes que o tráfego ao vivo dos dispositivos possa fluir.

---

## Resumo executivo

O gateway de ingestão XVM construído para a frota NavorTech / Bobcat está **completo, implantado e atualmente em execução** no servidor de produção `38.247.130.26`. Está saudável e pronto para receber frames dos rastreadores VL06 (`PNMB`) e VL08 (`0592`).

Estamos bloqueados por uma única questão, bem compreendida: o provedor de hospedagem que opera a rede de `38.247.130.26` está descartando silenciosamente todo o tráfego UDP de entrada na borda da rede deles — ou seja, antes que os pacotes cheguem ao nosso servidor. Essa é uma configuração padrão em muitos provedores de servidores dedicados brasileiros (UDP é filtrado por padrão para prevenir ataques de reflexão/amplificação) e é corrigida com uma alteração de uma linha de ACL no lado do provedor.

**Não há nada que a NavorTech precise fazer.** Os rastreadores não precisam ser regravados, reapontados ou reiniciados. O destino atual configurado neles, `38.247.130.26:6600`, está exatamente correto. Assim que a ACL do provedor for atualizada, a telemetria começará a chegar em segundos — automaticamente, sem qualquer ação em campo.

A Safeon já abriu o chamado de suporte com o provedor de hospedagem. O tempo típico de retorno para esse tipo de solicitação é de **2 a 48 horas**, dependendo da fila de nível 1 do provedor.

---

## O que está funcionando hoje

| Componente | Status |
| --- | --- |
| Binário do gateway compilado e instalado | ✓ `/opt/navortech-gateway` |
| `navortech-gateway.service` | ✓ ativo, reinicia automaticamente após reboot |
| Socket de escuta | ✓ `0.0.0.0:6600/udp` (verificado via `ss`) |
| Arquivo de captura | ✓ `/var/lib/navortech-gateway/xvm-live.txt` aberto em modo append |
| Parser de frames (RGP, RUV00, RUV01, RUV02, RUV03) | ✓ |
| Transmissor de ACK (conforme especificação §6) | ✓ dispositivos não retentam após receberem ACK |
| Verificação do checksum do protocolo (XOR-LRC) | ✓ |
| Firewall do servidor | ✓ inativo — não é a causa do bloqueio |
| Hardening do servidor (unidade systemd) | ✓ executa como usuário não privilegiado `navortech`, com filesystem restrito |

O gateway não recebeu nenhum datagrama, não porque não esteja pronto, mas porque nenhum datagrama está fisicamente chegando ao servidor.

---

## O que está nos bloqueando

### O que observamos

Após o deploy, monitoramos o socket UDP ao vivo por vários minutos. Zero pacotes chegaram. Para descartar o código do gateway ou os rastreadores, enviamos pacotes UDP de teste a partir de uma fonte externa conhecida e confiável (uma estação de trabalho independente) diretamente para `38.247.130.26:6600`, `:6601` e `:22000`. **Cada um dos pacotes de teste foi perdido** antes de chegar ao servidor.

Enquanto isso, o tráfego TCP para o mesmo servidor (SSH na porta 22) funciona perfeitamente. A assimetria — TCP funcionando, UDP perdido em todas as portas — é a assinatura clássica de um filtro UDP aplicado na borda da rede pelo equipamento do provedor de hospedagem.

### Como sabemos que não é do nosso lado

Verificamos os três únicos pontos onde um servidor Linux pode descartar tráfego:

- A aplicação: o gateway está com socket aberto e ocioso, esperando entrada.
- O firewall do sistema operacional (`ufw`): `Status: inactive`.
- Os filtros de pacote do kernel (`iptables`, `nftables`): ambos vazios, política padrão `ACCEPT`.

Em seguida, executamos `tcpdump` diretamente na interface de rede — o `tcpdump` opera **abaixo** do firewall na pilha de rede do Linux, então até mesmo tráfego que *seria* descartado por um firewall local ainda é visível para ele. O `tcpdump` reportou `0 packets received by filter` em uma janela completa de 60 segundos. Os pacotes não estão sendo descartados no servidor; eles não estão chegando ao servidor.

### Como sabemos que não é do lado dos rastreadores

Os pacotes de teste externos que enviamos — de uma rede completamente diferente, sem qualquer envolvimento do código do gateway — foram perdidos da mesma forma que os pacotes (presumivelmente normais) que os Bobcats estão emitindo. Qualquer coisa, de qualquer fonte, em qualquer porta UDP, atingindo `38.247.130.26` está sendo filtrada na borda upstream.

Os rastreadores quase certamente estão transmitindo corretamente. Apenas ainda não conseguimos vê-los.

---

## A solução

O provedor de hospedagem precisa permitir tráfego UDP de entrada na porta 6600 para `38.247.130.26` a partir de qualquer IP de origem. É uma única linha de ACL no equipamento de rede deles. Uma vez aplicada, nenhuma ação adicional é necessária de ninguém — o gateway já está em execução e captará os frames de entrada imediatamente.

A Safeon abriu esse chamado com evidências técnicas (a saída do `tcpdump`, a tabela de roteamento, os contadores de firewall vazios) para que o NOC do provedor possa validá-lo sem idas e vindas. Notificaremos a NavorTech no momento em que a alteração for aplicada.

---

## Verificação após a porta ser liberada

No momento em que o provedor confirmar a alteração, faremos:

1. Enviaremos um pacote UDP de teste para `38.247.130.26:6600` a partir de uma máquina externa e confirmaremos que ele aparece no log do gateway em até um segundo.
2. Acompanharemos o journal ao vivo em busca dos primeiros frames reais dos dispositivos (`rx peer=...:... ascii=">RGP...;ID=PNMB;...<"`).
3. Enviaremos uma amostra à NavorTech mostrando que os rastreadores estão emitindo corretamente e recebendo ACK.
4. Permitiremos cerca de 15 minutos de acúmulo, em seguida puxaremos o arquivo de captura de volta, executaremos nossa ferramenta de anonimização sobre ele e comprometeremos o corpus dourado resultante na suíte de testes — fixando o comportamento real dos dispositivos como linha de base de regressão.

A NavorTech não precisa estar em uma chamada para nada disso. Enviaremos uma confirmação por escrito com os primeiros frames decodificados como marco da entrega.

---

## O que a Safeon está construindo em paralelo enquanto aguardamos

A fila de chamados do provedor é a única coisa segurando o tráfego ao vivo — o trabalho de engenharia continua. Enquanto aguardamos, a Safeon está iniciando o **Marco 2: persistência de telemetria**:

- Esquema PostgreSQL para `machine`, `device`, `telemetry_raw` e `device_state` (conforme o guia de implementação §5)
- Bindings do Drizzle ORM e linha de base de migrations
- Conexão da saída do parser existente com as escritas no banco (cada frame parseado vira uma linha em `telemetry_raw` mais um upsert em `device_state`)

Quando a rede for desbloqueada e o primeiro frame chegar, ele não aparecerá apenas em um arquivo de log — chegará como linhas consultáveis, prontas para a camada do dashboard. Nenhum trabalho adicional de integração entre o listener e o banco de dados será necessário nesse momento.

---

## Resumo do que é necessário de cada parte

| Parte | Ação | Status |
| --- | --- | --- |
| Safeon | Construir, implantar e proteger o gateway | ✅ Concluído |
| Safeon | Diagnosticar o bloqueio, abrir chamado no provedor | ✅ Concluído |
| Safeon | Construir a camada de banco em paralelo | ⏳ Em andamento |
| Provedor de hospedagem | Liberar UDP/6600 de entrada para 38.247.130.26 | ⏳ Aguardando resposta |
| NavorTech | (nenhuma) | — |
| Operadores das Bobcats | (nenhuma) | — |

Quando o provedor responder, o projeto retoma automaticamente.
