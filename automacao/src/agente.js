import Anthropic from "@anthropic-ai/sdk";
import * as evo from "./evolution.js";
import * as db from "./db.js";
import { chaveDeNumero, NOTA_DO_AGENTE, primeiroNome } from "./conducao.js";

const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

const MODELO = "claude-haiku-5-5";

// ---------------------------------------------------------------------------
// Fatos verificados do Edital 01/2026-GMM (conferidos no PDF oficial da Fadesp
// em 17/11/2026). O modelo NUNCA inventa data: tudo sai desta tabela via
// ferramenta. Se o edital for retificado, muda-se aqui e só aqui.
// ---------------------------------------------------------------------------
const CRONOGRAMA = {
  inscricoes: "17/11/2026 a 28/12/2026, até as 17h do último dia, pelo site da Fadesp. Taxa de R$ 115,00.",
  isencao: "Pedido de isenção da taxa: 17 a 19/11/2026. Resultado preliminar em 27/11/2026, recursos em 30/11 e 01/12/2026, resultado definitivo em 04/12/2026. Têm direito: inscritos no CadÚnico, doadores de sangue, doadores de medula óssea, doadoras de leite materno, mulheres vítimas de violência doméstica e familiar, e pessoas com deficiência.",
  pagamento: "Último dia para pagar o boleto da inscrição: 28/12/2026.",
  homologacao: "Resultado preliminar das inscrições homologadas: 06/01/2027. Recursos em 07 e 08/01/2027. Resultado definitivo em 13/01/2027.",
  concorrencia: "Publicação da demanda e concorrência (candidatos por vaga): 13/01/2027.",
  local_de_prova: "Cartão de inscrição com o local de prova: 18/01/2027.",
  prova: "Prova objetiva: domingo, 24/01/2027. Ingresso das 7h às 8h, prova das 8h30 às 12h30, em Marabá. Duração de 4 horas.",
  gabarito: "Gabarito preliminar: 25/01/2027 até as 17h. Recursos em 26 e 27/01/2027. Gabarito definitivo em 05/02/2027.",
  taf: "Teste de Aptidão Física: 06 e 07/03/2027. É eliminatório, mas não pontua.",
  psicologica: "Avaliação psicológica: 03 e 04/04/2027. Eliminatória.",
  curso_de_formacao: "Curso de Formação: 01/09/2027 a 01/12/2027. É obrigatório e eliminatório.",
  resultado_final: "Resultado final definitivo: 20/12/2027.",
  vagas: "127 vagas no total: 60 de provimento imediato e 67 de cadastro de reserva. Apenas os 60 primeiros são convocados para a primeira turma do Curso de Formação.",
  requisitos: "Ensino médio completo, CNH categoria AB na posse, idade de 18 a 35 anos na inscrição, altura mínima de 1,60 m (homens) e 1,55 m (mulheres). Pela retificação do Edital 02/2026, de 17/11/2026, basta completar 18 anos até o início do Curso de Formação — candidato menor precisa de autorização do responsável, com firma reconhecida (Anexo VI).",
  salario: "Salário-base de R$ 2.076,40, mais as vantagens legais, para jornada de 40 horas semanais.",
  pontuacao: "A prova tem 40 questões e 100 pontos, com pesos diferentes: Conhecimentos Específicos (todo jurídico) são 15 questões de peso 4, valendo 60 pontos; Conhecimentos do Município de Marabá são 10 questões de peso 2, valendo 20 pontos; Língua Portuguesa são 5 questões de peso 2, valendo 10 pontos; Matemática e Raciocínio Lógico são 5 questões de peso 1, valendo 5 pontos; Noções de Informática são 5 questões de peso 1, valendo 5 pontos.",
  corte: "Para não ser eliminado é preciso fazer no mínimo 60 pontos (item 11.3) E ficar entre os 254 primeiros, que é o dobro das vagas (itens 11.4 e 11.7). A nota final do concurso é apenas a da prova objetiva (item 21.1): o TAF e a psicológica eliminam, mas não pontuam.",
};

// ---------------------------------------------------------------------------
// O menu da casa, com as palavras do Dr. Walter. Preço NUNCA sai da memória do
// modelo: sai daqui, por ferramenta. Se a oferta mudar, muda-se aqui e só aqui.
// ---------------------------------------------------------------------------
export const CATALOGO = {
  pastas: {
    nome: "Legislação Organizada por Pastas + 300 Questões Inéditas FADESP",
    preco: "R$ 9,99, ou R$ 9,98 pagando no Pix",
    pagavel: true,
    checkout: process.env.CAKTO_LINK_PASTAS || "",
    diga: "É a lei seca da prova organizada por pastas, com 300 questões inéditas e comentadas no padrão da Fadesp. Sai por R$ 9,99, ou R$ 9,98 no Pix.",
    detalhes: [
      "São 300 questões inéditas, todas comentadas pelos professores.",
      "Cobre as matérias de Direito do edital da Guarda de Marabá.",
      "É tudo em PDF, para baixar pelo link do Google Drive. Não existe material impresso.",
      "O acesso dura 3 meses, o que cobre o tempo que falta até a prova de janeiro de 2027.",
      "Pagamento único, não é mensalidade.",
      "A compra é pelo link oficial da Cakto, e o acesso ao Drive libera na hora que o pagamento cai.",
      "Na página de pagamento o produto aparece como *Pasta Organizada - Guarda Municipal de Marabá*. É o mesmo material.",
    ],
    apos_pagamento: "O acesso ao Drive libera na hora, e o comprovante vai para o seu e-mail.",
    pede_diagnostico:
      "Aproveita e responde este formulário, leva uns 5 minutos. É com ele que o Dr. Walter e o Dr. Diego veem a sua rotina e te dizem por onde começar nas pastas.",
  },
  mentoria: {
    nome: "Mentoria de Organização de Estudos",
    preco: "R$ 99,99",
    pagavel: true,
    checkout: process.env.CAKTO_LINK_MENTORIA || "",
    diga: "É a mentoria em que o Dr. Walter e o Dr. Diego montam o seu planejamento de estudo e acompanham você até a véspera da prova. Já inclui as pastas e as 300 questões. Sai por R$ 99,99, pagamento único.",
    detalhes: [
      "É online, do começo ao fim.",
      "O planejamento é individual: cronograma e planilha montados para a rotina de cada aluno.",
      "Os encontros são online e acontecem quantos forem necessários, individuais ou em grupo.",
      "Quem conduz são os dois professores, Dr. Walter Ruiz e Dr. Diego Souza.",
      "O acompanhamento vai da contratação até a véspera da prova da Guarda, em janeiro de 2027.",
      "Já inclui as pastas de legislação e as 300 questões comentadas, sem custo a mais.",
      "Pagamento único de R$ 99,99, não é mensalidade.",
      "O ponto de partida é o Formulário Diagnóstico, de 5 a 6 minutos, que mostra a rotina do aluno.",
      "Na página de pagamento ela aparece como *Planejamento e Organização de Estudos: Guarda Municipal de Marabá*. É a mesma mentoria.",
    ],
    apos_pagamento: "A equipe entra em contato aqui mesmo para começar.",
    pede_diagnostico:
      "O primeiro passo da mentoria é este formulário, de uns 5 minutos. É dele que sai o seu cronograma, montado em cima da sua rotina.",
  },
  diagnostico: {
    nome: "Diagnóstico Gratuito de Rotina",
    preco: "gratuito",
    pagavel: false,
    link: process.env.FORMULARIO_DIAGNOSTICO || "",
    diga: "É um formulário gratuito, de 5 a 6 minutos, em que você conta a sua rotina e o tempo que tem para estudar. É dele que os professores tiram o seu direcionamento, e é o ponto de partida tanto das pastas quanto da mentoria.",
    detalhes: [
      "Leva de 5 a 6 minutos e é respondido pelo próprio candidato.",
      "Não precisa agendar nada: é só preencher.",
      "Quem analisa são o Dr. Walter e o Dr. Diego, e a equipe retorna com a devolutiva.",
      "É gratuito e não tem compromisso de compra.",
      "É a primeira porta da casa: com a rotina da pessoa na mão, os professores sabem dizer se o caso é começar pelas pastas ou ir direto para o planejamento.",
    ],
  },
  sob_medida: {
    nome: "OAB e carreiras jurídicas",
    preco: "sob orçamento",
    pagavel: false,
    diga: "Para OAB e carreiras jurídicas a casa monta planejamento e caderno de questões sob medida, conforme a necessidade de cada um. O valor sai por orçamento, feito pela equipe.",
    detalhes: [
      "Não tem preço de tabela: cada caso é orçado pelos professores.",
      "Os dois produtos com preço fechado hoje são só os da Guarda de Marabá.",
      "Qualquer pedido de OAB ou carreira jurídica vai para a equipe fazer o orçamento.",
    ],
  },
  comprovante: {
    nome: "Envio de comprovante",
    preco: "não se aplica",
    pagavel: false,
    diga: "Quem compra pela Cakto não precisa mandar comprovante: a liberação é automática e o recibo vai para o e-mail. Se mesmo assim a pessoa quiser mandar, pode mandar aqui que a equipe confere.",
  },
};

const SISTEMA = `Você é o atendente da Juris Elite no WhatsApp. A Juris Elite é o projeto de preparação do Prof. Walter Ruiz e do Prof. Diego Souza, em Marabá, no Pará. Hoje o foco da casa é a Guarda Municipal de Marabá (Edital 01/2026, banca Fadesp, prova em janeiro de 2027), e a maioria que te procura é candidato dela. Mas isso é pano de fundo, não é chute: a casa também atende OAB e carreiras jurídicas, e você só sabe o que ESTA pessoa quer depois que ela falar. Nunca presuma o motivo do contato, e nunca anuncie a Guarda antes de a pessoa dizer que é disso que ela precisa.

O QUE VOCÊ É
Você é uma pessoa do atendimento da Juris Elite: a recepção e a linha de frente da venda. Recebe a pessoa com simpatia, diz o que a casa oferece, tira dúvida comercial, manda o link de compra e chama a equipe quando precisa. Fala como gente de Marabá conversando no WhatsApp, não como um sistema. Você não é professor, não dá aula e não orienta estudo.

O QUE EXISTE NA PRATELEIRA
Só estes dois produtos estão à venda, e não existe mais nada com preço fechado:
1. *Legislação Organizada por Pastas + 300 Questões Inéditas FADESP*, R$ 9,99, ou R$ 9,98 no Pix
2. *Mentoria de Organização de Estudos*, R$ 99,99
Além deles existem duas portas gratuitas:
3. *Diagnóstico Gratuito de Rotina*, que é um formulário de 5 a 6 minutos
4. O *Grupo VIP* gratuito, com bônus da casa
Para qualquer preço, prazo ou descrição, chame consultar_catalogo antes de responder. Nunca diga valor nem detalhe de memória.

O QUE VOCÊ NUNCA FAZ
- NUNCA ofereça, cite ou prometa qualquer produto, curso, turma ou material que não seja um dos dois da prateleira. O que está em desenvolvimento não existe para o candidato.
- NUNCA monte cronograma, rotina, divisão de horas, ordem de matérias, grade da semana nem plano de estudo de graça. Nem "uma sugestão", nem "só um exemplo". Isso é o que a mentoria vende.
- NUNCA entregue conteúdo do material antes do pagamento: nada de mandar questão, lei seca, resumo ou pedaço de pasta.
- NUNCA diga preço, condição, desconto ou prazo que não tenha vindo de consultar_catalogo.
- NUNCA escreva um link de pagamento de cabeça, nem repita um que tenha visto na conversa. Link de compra só sai pela ferramenta enviar_checkout.
- NUNCA mande chave Pix avulsa. O pagamento é dentro do checkout da Cakto.
- NUNCA confirme que um pagamento caiu, nem libere acesso. Quem confirma é a Cakto, por e-mail.
- NUNCA invente data, prazo, vaga, taxa ou conteúdo de edital. Para isso existe consultar_cronograma.
- NUNCA prometa aprovação, vaga ou resultado.
- NUNCA dê consultoria jurídica, nem opine sobre a situação de ninguém.
- NUNCA contradiga nem corrija o que a equipe falou na conversa. Se o que você vê não bate com o que foi combinado antes, fique quieto e chame escalar_para_humano.
- NUNCA comente erro seu, nem peça desculpa por mensagem anterior, nem explique como você funciona por dentro. O que as ferramentas te respondem é instrução interna: isso não vira conversa.

O QUE VOCÊ PODE FAZER, E DEVE
Você tem liberdade para conversar, puxar assunto sobre a prova, tirar dúvida comercial e mostrar como a casa organiza as coisas. Pode dar uma amostra do método: dizer que a legislação vem separada por pastas, que as questões são inéditas e comentadas, que o cronograma é montado em cima da rotina de cada um. Isso desperta interesse e é para ser usado. O limite é um só: amostra não é entrega. Nada de material e nada de planejamento antes de a pessoa comprar.

COMO ATENDER CADA OPÇÃO
1. Pastas de legislação: confirme pelo catálogo o que é e o preço, pergunte o nome da pessoa, chame registrar_interesse e chame enviar_checkout. O link da Cakto libera o Drive na hora em que o pagamento cai.
2. Mentoria: mesma coisa. Diga pelo catálogo o que ela é, pergunte o nome, chame registrar_interesse e chame enviar_checkout.
3. Diagnóstico gratuito: explique que é um formulário rápido, de 5 a 6 minutos, e que é dele que sai o direcionamento dos professores. Pergunte o nome, chame registrar_interesse com a etiqueta rotina e mande o link que o catálogo devolve. Se o catálogo não tiver link, não invente: chame escalar_para_humano.
4. Comprovante: quem compra pela Cakto não precisa mandar comprovante, porque a liberação é automática e o recibo vai por e-mail. Diga isso. Se a pessoa mandar assim mesmo, agradeça e deixe com a equipe, sem confirmar nada.

QUANDO FALAM EM PAGAR
Se a pessoa já disse qual produto quer, chame enviar_checkout. O link sai logo depois da sua mensagem, então anuncie ("já te mando o link") e não escreva como se ela já tivesse recebido.
No link dá para pagar por Pix, cartão de crédito, Apple Pay e Google Pay. No Pix, o recebedor aparece como *Walter Ruiz Bogaz Neto*, que é o professor: avise antes, para a pessoa não estranhar o nome na tela do banco.
Assim que o pagamento cai, o acesso ao Drive libera na hora e o comprovante vai para o e-mail da pessoa.
Se ela pedir desconto, parcelamento, outro valor ou outra forma de pagamento, não negocie: chame escalar_para_humano.

QUEM NÃO É DA GUARDA DE MARABÁ
A casa atende OAB e carreiras jurídicas, mas isso é feito sob medida e sai por orçamento, que é a equipe quem faz. Não invente preço, não prometa prazo e não ofereça os produtos da Guarda como se servissem. Explique em uma linha, pergunte o nome e chame escalar_para_humano.

O GRUPO VIP GRATUITO
É gratuito, tem conteúdo da casa e bônus como o Mapa de Pontos. Para entrar, a pessoa precisa seguir no Instagram os três perfis: *@juriselite.oficial*, o Prof. Walter Ruiz e o Prof. Diego Souza. Peça isso primeiro, com jeito, e depois chame convidar_para_grupo.

O DIAGNÓSTICO É A PRIMEIRA PORTA
Quem ainda não escolheu nada vai para o Diagnóstico Gratuito de Rotina, antes de qualquer oferta. É gratuito, leva de 5 a 6 minutos e é a peça que faz o resto funcionar: é dele que os professores tiram a rotina da pessoa, o tempo que ela tem e onde ela está travando. Com isso na mão, eles sabem dizer se o caso é começar pelas pastas ou ir direto para o planejamento, e a mentoria já começa com o terreno conhecido.
Mas o diagnóstico NÃO é a primeira coisa que você fala. Ele entra depois do primeiro papo, quando a pessoa já falou e você entendeu que ela ainda não escolheu nada. Aí sim traga assim: diga o que é, que é gratuito e sem compromisso, que leva uns cinco minutos, pergunte o nome e mande o link do catálogo. Depois chame registrar_interesse com a etiqueta rotina. Nunca abra a conversa com ele.
Quem já chegou decidido não passa por aqui: se a pessoa disse que quer as pastas ou a mentoria, venda. Não atravesse uma compra com formulário.

QUEM CHEGA SEM ESCOLHER NADA
No primeiro contato (um "oi", um "boa noite", um "quero saber do curso"), responda com UMA mensagem só, curta e calorosa: cumprimente e pergunte, de forma ABERTA e NEUTRA, como você pode ajudar. Tipo "como posso te ajudar?" ou "em que posso te ajudar hoje?". NÃO adivinhe o motivo do contato: não cite a Guarda de Marabá, não cite concurso nenhum, não cite produto, não mande link, não ofereça diagnóstico, não despeje nada. A maioria procura pela Guarda, mas você NÃO sabe o que esta pessoa quer até ela falar, e chutar o assunto na saudação é cara de robô. Espere a pessoa dizer o que procura.
Só depois que ela disser o que quer é que você conduz: no momento certo, apresenta o diagnóstico gratuito ou mostra o que a casa tem. Atenda como um bom vendedor de verdade: acolhe, escuta, entende, e só então oferece. Uma coisa de cada vez, sem pressa e sem empurrar.
Se a pessoa só quiser saber do concurso, responda a dúvida dela com consultar_cronograma e puxe conversa a partir daí.

O HORÁRIO DA EQUIPE
A equipe humana atende em horário comercial, de segunda a sexta, das 8h às 18h. Você fica no ar o tempo todo, e os links de compra e o formulário funcionam a qualquer hora, inclusive de madrugada e no fim de semana.
Quando precisar chamar alguém, diga que já avisou a equipe e que ela responde no horário comercial. Nunca prometa "em instantes" e nunca chute a hora em que alguém vai responder.

O ÚNICO ARGUMENTO QUE VOCÊ USA, E EM UMA FRASE SÓ
Conhecimentos Específicos, que é todo direito, vale 60 dos 100 pontos da prova. Quem zera o direito não alcança o corte, nem acertando tudo no resto. Diga isso quando couber, em uma frase, e pare. Não desdobre em aula e não divida o tempo de estudo da pessoa.

COMO VOCÊ ESCREVE
- No primeiro contato, UMA mensagem só. Nunca empilhe cumprimento e oferta na largada, nem mande uma mensagem em cima da outra: cumprimentou, fez uma pergunta, parou e esperou. No resto da conversa, no máximo DUAS mensagens por vez, de até 4 linhas cada, e uma ideia por mensagem. Se não couber, é porque você está falando demais.
- Deixe a conversa respirar. Reaja ao que a pessoa falou antes de oferecer qualquer coisa. Não despeje diagnóstico, produto nem link sem a pessoa ter pedido ou dado abertura. Quem vende empurrando afasta.
- Uma pergunta por vez, e nunca a mesma pergunta duas vezes na mesma conversa. Se já perguntou e a pessoa não respondeu, siga sem ela.
- Português do Brasil, informal e respeitoso, do jeito que se fala em Marabá. Nada de juridiquês.
- Negrito do WhatsApp é com asterisco simples: *assim*. Nunca markdown, nem ## nem **.
- No máximo um emoji por mensagem, e quase sempre nenhum.
- Você fala como gente da casa: uma pessoa do atendimento da Juris Elite, que trabalha com o Dr. Walter e o Dr. Diego. NUNCA se apresente como robô, bot, inteligência artificial, sistema ou atendimento automático, e nunca diga "sou o atendimento automático". Se a pessoa perguntar se você é um robô ou um atendente virtual, não entre no assunto nem confirme nada: responda leve e humano, diga que aqui é o atendimento da Juris Elite e que, se precisar, você já chama o Dr. Walter ou o Dr. Diego, e siga ajudando no que ela quer.
- Sobre o nome: cada conversa te diz no contexto se o contato tem nome. Se tiver, trate a pessoa por ele, com naturalidade, e NÃO peça o nome de novo em etapa nenhuma. Se não tiver, não invente nem cumprimente por nome; só quando uma etapa exigir o nome é que você pergunta.
- Se a pessoa pedir para falar com uma pessoa, ou estiver irritada, chame escalar_para_humano na hora, sem insistir e sem tentar resolver.
- Nunca prometa que alguém responde "em instantes". Diga que já avisou a equipe e que ela responde no horário comercial.

COMO O ENVIO FUNCIONA
Link e PDF não saem no instante em que você chama a ferramenta: saem DEPOIS da sua mensagem. Então anuncie o que vem ("já te mando o link do grupo") e nunca escreva como se a pessoa já tivesse recebido.
`;

// Quem tem preço de tabela tem link de compra, e só esses dois têm. O link,
// o nome e o valor saem sempre do catálogo, nunca da memória do modelo: foi
// de memória que nasceu o R$ 197 que não existia.
const ITENS_PAGAVEIS = Object.keys(CATALOGO).filter((k) => CATALOGO[k].pagavel);

export const FERRAMENTAS = [
  {
    name: "consultar_catalogo",
    description:
      "Consulta o que a Juris Elite oferece e por quanto. Use SEMPRE antes de dizer qualquer preço, descrição de material ou condição de pagamento. Nunca responda isso de memória: o catálogo muda e a sua memória não.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        item: {
          type: "string",
          enum: [...Object.keys(CATALOGO), "tudo"],
          description: "O item do menu, ou 'tudo' para o menu inteiro.",
        },
      },
      required: ["item"],
    },
  },
  {
    name: "consultar_cronograma",
    description:
      "Consulta os dados oficiais verificados do Edital 01/2026 da Guarda Municipal de Marabá. Use SEMPRE antes de afirmar qualquer data, prazo, requisito, valor de taxa, salário, número de vagas, regra de pontuação ou corte. Nunca responda essas informações de memória.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        assunto: {
          type: "string",
          enum: Object.keys(CRONOGRAMA),
          description: "O tópico a consultar.",
        },
      },
      required: ["assunto"],
    },
  },
  {
    name: "enviar_mapa_de_pontos",
    description:
      "Envia o PDF do Mapa de Pontos direto na conversa. NÃO é o caminho padrão: o Mapa fica no grupo, e o normal é chamar convidar_para_grupo. Use esta ferramenta só quando a pessoa disser que não quer ou não pode entrar em grupo, ou quando pedir o arquivo de novo depois de já ter recebido o convite. Não envie duas vezes.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    name: "registrar_interesse",
    description:
      "Registra no sistema o nome do candidato e qual bloco da prova mais o preocupa. Chame assim que descobrir qualquer um dos dois — não espere ter os dois.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        nome: { type: ["string", "null"], description: "Primeiro nome do candidato, se ele disse." },
        // anyOf, e nao type com lista mais enum: a API recusa enum de strings
        // quando o type declarado inclui null ("Enum value 'direito' does not
        // match declared type"). Com schema invalido a chamada inteira falha,
        // o agente nao responde nada, e o candidato fica no vacuo.
        etiqueta: {
          anyOf: [
            { type: "string", enum: ["direito", "maraba", "basicas", "rotina"] },
            { type: "null" },
          ],
          description:
            "direito = os 60 pontos de Conhecimentos Específicos; maraba = os 20 pontos do município; basicas = português, matemática e informática; rotina = não consegue manter constância no estudo.",
        },
      },
      required: ["nome", "etiqueta"],
    },
  },
  {
    name: "convidar_para_grupo",
    description:
      "Envia o link do grupo de WhatsApp dos candidatos da Guarda Municipal de Marabá, onde fica o Mapa de Pontos. É a PRIMEIRA ferramenta a chamar numa conversa nova sobre a Guarda: é assim que a pessoa recebe o material. NÃO chame para quem procura OAB ou outra carreira: nesse caso, escalar_para_humano. Não envie duas vezes.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    name: "enviar_checkout",
    description:
      "Envia o link oficial de compra da Cakto para quem JÁ decidiu fechar um dos dois produtos da Guarda. Diga qual item é: o link sai junto com o nome do produto e o valor de tabela. NÃO use com quem está só perguntando preço, pedindo desconto ou ainda decidindo: nesses casos use escalar_para_humano. Nunca escreva um link de pagamento de cabeça: só existe o que esta ferramenta manda.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        item: {
          type: "string",
          enum: ITENS_PAGAVEIS,
          description: "O produto que a pessoa está comprando.",
        },
      },
      required: ["item"],
    },
  },
  {
    name: "escalar_para_humano",
    description:
      "Avisa a equipe da Juris Elite que esta conversa precisa de um professor. Use em: pedido de desconto ou qualquer negociação de valor, reclamação, pessoa irritada, pedido explícito de falar com uma pessoa, dúvida jurídica individual, ou qualquer pergunta sobre o edital que a ferramenta consultar_cronograma não responde.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        motivo: { type: "string", description: "Uma frase dizendo por que precisa de um humano." },
      },
      required: ["motivo"],
    },
  },
];

/**
 * Executa uma ferramenta. O que for para o CANDIDATO nao e enviado aqui:
 * entra em `pendentes` e sai depois da fala do atendente.
 *
 * Motivo: a ferramenta roda no meio do raciocinio, e o texto do modelo so
 * existe quando o ciclo termina. Enviando na hora, o link chegava ANTES do
 * "boa tarde", e a conversa comecava com um link seco na cara da pessoa.
 * Aviso para a equipe continua imediato: nao e o candidato que le.
 */
async function executarFerramenta(nome, entrada, lead, pendentes) {
  switch (nome) {
    case "consultar_catalogo": {
      if (entrada.item === "tudo") {
        return Object.values(CATALOGO)
          .map((p) => `${p.nome} (${p.preco}): ${p.diga}`)
          .join("\n");
      }
      const item = CATALOGO[entrada.item];
      if (!item) return "Esse item não existe no catálogo. Não invente: chame escalar_para_humano.";
      const linhas = [`${item.nome} (${item.preco})`, item.diga];
      if (item.detalhes) linhas.push("Detalhes conferidos com os professores:", ...item.detalhes.map((d) => "- " + d));
      if (item.checkout) linhas.push("Para fechar, chame enviar_checkout. Nunca escreva o link você mesmo.");
      if (item.link) linhas.push("Link para mandar: " + item.link);
      if (item.link === "") linhas.push("O link deste item ainda não está cadastrado aqui. Não invente link: chame escalar_para_humano.");
      linhas.push("Se perguntarem detalhe que não está aqui, não complete de cabeça: chame escalar_para_humano.");
      return linhas.join("\n");
    }

    case "consultar_cronograma": {
      const texto = CRONOGRAMA[entrada.assunto];
      return texto || "Esse dado não consta na base verificada. Chame escalar_para_humano.";
    }

    case "enviar_mapa_de_pontos": {
      if (lead.mapa_enviado) return "O Mapa de Pontos já foi enviado antes. Não envie de novo.";
      const url = process.env.MAPA_PONTOS_URL;
      if (!url) {
        await db.registrarEvento(lead.id, "mapa_sem_url", {});
        return "Ainda não há PDF configurado. Explique a tabela de pesos em texto e siga a conversa.";
      }
      pendentes.push({
        tipo: "documento",
        url,
        arquivo: "Mapa-de-Pontos-Guarda-Maraba.pdf",
        legenda: "Mapa de Pontos da Guarda de Marabá",
      });
      await db.marcarLead(lead.id, { mapa_enviado: true });
      await db.registrarEvento(lead.id, "mapa_enviado", {});
      lead.mapa_enviado = true;
      return "PDF vai sair logo depois da sua mensagem. Avise que esta mandando e comente em uma linha o que ele mostra.";
    }

    case "registrar_interesse": {
      const campos = {};
      if (entrada.nome) campos.nome = entrada.nome;
      if (entrada.etiqueta) {
        campos.etiqueta = entrada.etiqueta;
        campos.estagio = "qualificado";
      }
      if (Object.keys(campos).length === 0) return "Nada a registrar.";
      await db.marcarLead(lead.id, campos);
      await db.registrarEvento(lead.id, "interesse_registrado", entrada);
      Object.assign(lead, campos);
      return "Registrado.";
    }

    case "convidar_para_grupo": {
      if (lead.convite_enviado) return "O convite do grupo já foi enviado antes.";
      const url = process.env.GRUPO_CONVITE_URL;
      if (!url) return "Ainda não há grupo configurado. Não prometa convite agora.";
      // A mensagem diz o que a pessoa ganha ao entrar. Convite sem motivo
      // vira link ignorado, e o grupo e a porta de entrada do funil.
      pendentes.push({
        tipo: "texto",
        texto:
          `O *Mapa de Pontos* está no grupo dos candidatos, junto com o conteúdo diário.\n\n` +
          `Entra aqui: ${url}\n\n` +
          `O link do PDF está na descrição do grupo, dá para baixar a qualquer hora.`,
      });
      await db.marcarLead(lead.id, { convite_enviado: true, estagio: "no_grupo" });
      await db.registrarEvento(lead.id, "convite_enviado", {});
      lead.convite_enviado = true;
      return "O convite vai sair logo depois da sua mensagem. Cumprimente a pessoa e diga, em uma linha, que esta mandando o link do grupo onde fica o Mapa.";
    }

    case "enviar_checkout": {
      const item = CATALOGO[entrada.item];
      if (!item || !item.pagavel) {
        return "Esse item não é vendido por link. Não invente: chame escalar_para_humano.";
      }
      if (!item.checkout) {
        return "O link de compra desse produto ainda não está configurado aqui. " +
               "Não invente link nenhum e não mande chave Pix: chame escalar_para_humano.";
      }

      pendentes.push({
        tipo: "texto",
        texto:
          `*${item.nome}*\n` +
          `${item.preco}\n\n` +
          `${item.checkout}\n\n` +
          "No link dá para pagar por Pix, cartão, Apple Pay e Google Pay. " +
          "No Pix o recebedor aparece como *Walter Ruiz Bogaz Neto*, que é o professor. " +
          "Assim que o pagamento cai, o acesso libera na hora e o comprovante vai para o seu e-mail.",
      });

      await db.marcarPagamento(lead.id, "checkout_enviado", entrada.item);
      await db.registrarEvento(lead.id, "checkout_enviado", { item: entrada.item, valor: item.preco });

      // A equipe acompanha a venda pela Cakto, mas precisa saber que o link
      // saiu: e por aqui que ela percebe quem travou no meio do caminho.
      const aviso = numerosDaEquipe(lead);
      if (aviso.length) {
        const texto =
          `*Link de compra enviado*\n` +
          `${lead.nome || "sem nome"} (${lead.telefone})\n` +
          `${item.nome}, ${item.preco}\n` +
          `A baixa e a liberação do material são automáticas pela Cakto.` +
          "\n\n" +
          "Quando a venda cair, digitem */confirmado* aqui dentro da conversa: " +
          "o atendente parabeniza a pessoa e manda o Formulário Diagnóstico para ela.";
        await Promise.allSettled(aviso.map((n) => evo.enviarTexto(n, texto)));
      }

      return "O link vai sair logo depois da sua mensagem. Avise que ele está vindo. " +
             "NUNCA confirme que o pagamento caiu: quem confirma é a Cakto, por e-mail.";
    }

    case "escalar_para_humano": {
      await db.marcarLead(lead.id, { escalado: true });
      await db.registrarEvento(lead.id, "escalado", entrada);
      // Escalar NÃO é só avisar: a conversa passa para a equipe e o agente
      // se cala até alguém digitar /agente. Avisar e continuar falando é o
      // que fez o robô desmentir uma venda que já estava fechada.
      await db.definirConducao(lead.id, "equipe", NOTA_DO_AGENTE);
      await avisarEquipe(lead, entrada.motivo);
      return "Equipe avisada e conversa entregue a ela. Diga ao candidato, em UMA linha, " +
             "que alguém da equipe fala com ele em instantes. Não pergunte mais nada e não se despeça duas vezes.";
    }

    default:
      return `Ferramenta desconhecida: ${nome}`;
  }
}

/**
 * Avisa a equipe, no WhatsApp dela, que uma conversa precisa de gente.
 *
 * Lista separada por vírgula, e não um número só: com plantão único, celular
 * desligado significa candidato esperando sem que ninguém saiba. Falha de um
 * envio não impede os outros.
 */
/**
 * Os números da equipe, menos o da própria pessoa que está sendo atendida.
 *
 * Alguém da equipe testando o atendente do próprio número recebia, dentro da
 * conversa de teste, o recado interno sobre si mesma. Aconteceu no primeiro
 * teste, 19/11, e assusta: parece vazamento, e não é.
 */
function numerosDaEquipe(lead) {
  const meu = chaveDeNumero(lead?.telefone);
  return (process.env.EQUIPE_WHATSAPP || "")
    .split(",").map((n) => n.trim()).filter(Boolean)
    .filter((n) => chaveDeNumero(n) !== meu);
}

/** Manda um texto qualquer para a equipe, menos para quem está sendo atendido. */
export async function avisarEquipeTexto(lead, texto) {
  const equipe = numerosDaEquipe(lead);
  if (!equipe.length) return;
  await Promise.allSettled(equipe.map((n) => evo.enviarTexto(n, texto)));
}

export async function avisarEquipe(lead, motivo) {
  const equipe = numerosDaEquipe(lead);
  if (!equipe.length) return;
  const aviso =
    `*Atendimento precisa de vocês*\n` +
    `Candidato: ${lead.nome || "sem nome"} (${lead.telefone})\n` +
    `Motivo: ${motivo}\n\n` +
    `O atendente já se calou nessa conversa. Respondam por ela mesma.\n` +
    `Para devolver ao atendente depois, digitem */agente* lá dentro.`;
  await Promise.allSettled(equipe.map((n) => evo.enviarTexto(n, aviso)));
}

/**
 * Processa uma mensagem recebida e devolve o texto a enviar de volta.
 * Faz o laço de tool use manualmente para poder persistir cada passo.
 */
export async function responder(lead, historico, mensagemRecebida) {
  // Tudo que for para o candidato entra aqui e sai DEPOIS da fala do
  // atendente. Quem envia e o servidor, na ordem certa.
  const pendentes = [];
  // Marcadores de midia crua ("[audio]", "[imagem]"...) foram tratados fora do
  // modelo (transcricao, comprovante, fallback). Se um deles entra no historico
  // como turno do usuario, o modelo le aquilo como um pedido em aberto e fica se
  // desculpando por ele em mensagens seguintes. Entao some com eles daqui.
  const marcadoresMidia = new Set(["[imagem]", "[documento]", "[audio]", "[video]", "[figurinha]"]);
  const mensagens = [
    ...historico
      .filter((m) => !(m.direcao === "recebida" && marcadoresMidia.has((m.conteudo || "").trim().toLowerCase())))
      .map((m) => ({
        role: m.direcao === "recebida" ? "user" : "assistant",
        content: m.conteudo,
      })),
    { role: "user", content: mensagemRecebida },
  ];

  // Atendimento humanizado chama a pessoa pelo nome quando o contato traz um.
  // O nome vem do WhatsApp (pushName) e varia a cada conversa, entao entra num
  // segundo bloco de system, depois do SISTEMA cacheado, sem quebrar o cache.
  const nome = primeiroNome(lead?.nome, lead?.telefone);
  const contextoNome = nome
    ? `Contexto desta conversa: o contato do WhatsApp se chama *${nome}*. ` +
      `Cumprimente e trate a pessoa por esse primeiro nome, com naturalidade, ` +
      `principalmente no primeiro "oi". Voce ja tem o nome: nao pergunte o nome ` +
      `de novo, e use esse quando precisar registrar algo.`
    : `Contexto desta conversa: este contato nao tem nome salvo no WhatsApp. ` +
      `Nao invente nome e nao cumprimente por nome. Se em algum momento precisar ` +
      `do nome para registrar algo, ai sim pergunte com jeito.`;

  let resposta;
  for (let volta = 0; volta < 6; volta++) {
    resposta = await client.messages.create({
      model: MODELO,
      max_tokens: 2048, // resposta de WhatsApp é curta de propósito
      output_config: { effort: "low" }, // atendimento precisa ser rápido e barato
      // tools e system formam o prefixo estável do cache: ambos são fixos.
      tools: FERRAMENTAS,
      system: [
        { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
        { type: "text", text: contextoNome },
      ],
      messages: mensagens,
    });

    if (resposta.stop_reason === "refusal") {
      await db.registrarEvento(lead.id, "recusa_modelo", { detalhes: resposta.stop_details ?? null });
      return {
        texto: "Deixa eu chamar um dos professores para te responder isso direitinho. Só um instante.",
        pendentes: [],
      };
    }

    if (resposta.stop_reason !== "tool_use") break;

    const chamadas = resposta.content.filter((b) => b.type === "tool_use");
    mensagens.push({ role: "assistant", content: resposta.content });

    const resultados = [];
    for (const chamada of chamadas) {
      let saida;
      try {
        saida = await executarFerramenta(chamada.name, chamada.input, lead, pendentes);
        resultados.push({ type: "tool_result", tool_use_id: chamada.id, content: String(saida) });
      } catch (erro) {
        console.error(`[ferramenta:${chamada.name}]`, erro.message);
        await db.registrarEvento(lead.id, "erro_ferramenta", {
          ferramenta: chamada.name,
          erro: erro.message,
        });
        resultados.push({
          type: "tool_result",
          tool_use_id: chamada.id,
          content: `Falhou: ${erro.message}`,
          is_error: true,
        });
      }
    }
    // Todos os tool_result vão numa ÚNICA mensagem de usuário.
    mensagens.push({ role: "user", content: resultados });
  }

  const texto = (resposta?.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (resposta?.usage) {
    await db.registrarEvento(lead.id, "uso_modelo", {
      entrada: resposta.usage.input_tokens,
      saida: resposta.usage.output_tokens,
      cache_leitura: resposta.usage.cache_read_input_tokens ?? 0,
      cache_escrita: resposta.usage.cache_creation_input_tokens ?? 0,
    });
  }

  return { texto, pendentes };
}
