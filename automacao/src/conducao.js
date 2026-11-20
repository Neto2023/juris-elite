// Quem conduz a conversa: o atendente automático ou alguém da equipe.
//
// Só decisão pura mora aqui, sem banco e sem rede, para poder ser testada
// sozinha. Quem grava o estado é o db; quem obedece é o server.

/** Os comandos que a equipe digita DENTRO da conversa do candidato. */
/**
 * A nota que o agente grava quando ele mesmo entrega a conversa à equipe.
 *
 * Serve para separar duas coisas que pareciam uma só: alguém da equipe entrar
 * na conversa, que cala o agente na hora, e o agente escalar sozinho, que não
 * pode calar a frase que ele ainda vai dizer nem a chave Pix que vem atrás.
 */
export const NOTA_DO_AGENTE = "escalado pelo agente";

/** A conversa está parada porque chegou comprovante e a equipe tem que conferir. */
export const NOTA_COMPROVANTE = "comprovante em conferência";

/**
 * A resposta em curso deve parar no meio do caminho?
 *
 * Só quando gente de verdade entrou na conversa. Se quem entregou a conversa
 * foi o próprio agente, ao escalar, ele ainda tem uma frase para dizer e, às
 * vezes, uma chave Pix para entregar atrás dela. Confundir os dois casos fez
 * três conversas morrerem caladas em 19/11.
 */
export function calaOAgente(conduz, nota) {
  return conduz === "equipe" && nota !== NOTA_DO_AGENTE;
}

export const COMANDOS = new Map([
  ["/assumir", "equipe"],
  ["/agente", "agente"],
  // Quem confere o Pix é gente. O atendente só avisa o candidato que o
  // pagamento entrou depois que alguém da equipe digitar isto na conversa.
  ["/confirmado", "confirmado"],
  ["/confirmar", "confirmado"],
  ["/pago", "confirmado"],
]);

/**
 * Lê o comando de uma mensagem da equipe. Devolve 'equipe', 'agente' ou null.
 *
 * Aceita o comando sozinho ou seguido de texto ("/assumir vou ligar pra ela"),
 * porque é assim que gente escreve. Não aceita no meio da frase: quem escreve
 * "depois eu digito /agente" está conversando, não comandando.
 */
export function comandoDe(texto) {
  const limpo = String(texto || "").trim().toLowerCase();
  if (!limpo.startsWith("/")) return null;
  for (const [comando, destino] of COMANDOS) {
    if (limpo === comando || limpo.startsWith(`${comando} `)) return destino;
  }
  return null;
}

/**
 * Quem pede para falar com gente.
 *
 * De propósito é generoso. Entregar para um humano sem precisar custa um
 * aviso no WhatsApp da equipe; insistir com robô em quem já pediu uma pessoa
 * custa o candidato.
 */
const PEDE_HUMANO =
  /\b(falar|conversar|atender|atendimento|contato)\b[^.?!\n]{0,40}\b(algu[ée]m|uma pessoa|pessoa de verdade|atendente|humano|de verdade|respons[áa]vel|equipe|professor[a]?|secret[áa]ri[ao])\b/i;

export function pedeHumano(texto) {
  return PEDE_HUMANO.test(String(texto || ""));
}

/**
 * Compara telefone pelos últimos 8 dígitos.
 *
 * O mesmo celular aparece como 5594999990000 e 559499990000 conforme a idade
 * do contato: o nono dígito entrou em 2012 e o WhatsApp ainda devolve as duas
 * formas. Os 8 finais são o que não muda, e bastam para distinguir um número
 * de outro dentro de uma lista pequena.
 */
export function chaveDeNumero(numero) {
  return String(numero || "").replace(/\D/g, "").slice(-8);
}

/** Lê NUMEROS_LIBERADOS (lista separada por vírgula) e devolve um Set. */
export function listaDeNumeros(valor) {
  const chaves = String(valor || "")
    .split(",")
    .map(chaveDeNumero)
    .filter((n) => n.length === 8);
  return new Set(chaves);
}

/**
 * Durante os testes o atendente só fala com a lista. Lista vazia é operação
 * normal: atende todo mundo. Fora da lista ele não responde nada, e quem
 * cuida da conversa é a equipe, na mão, como já vinha fazendo.
 */
export function liberado(telefone, lista) {
  if (!lista || lista.size === 0) return true;
  return lista.has(chaveDeNumero(telefone));
}
