# Torre de Hanói

Jogo da Torre de Hanói em **TypeScript puro** (sem frameworks) — HTML, CSS e TS compilado para JS, sem nenhuma dependência de runtime.

## Como jogar

- Escolha o número de discos (3 a 8).
- Clique em um pino para pegar o disco do topo e clique em outro pino para soltá-lo — ou simplesmente arraste e solte.
- Não é permitido colocar um disco maior sobre um disco menor.
- O objetivo é mover toda a pilha do pino da esquerda para o pino da direita.
- O jogo mostra o número de movimentos, o mínimo teórico (2ⁿ − 1) e guarda seu recorde por quantidade de discos (salvo localmente no navegador).

## Rodando localmente

Não há build necessário para jogar: `dist/main.js` já vem compilado e versionado.

```bash
# opção 1: abra o index.html diretamente no navegador

# opção 2: sirva a pasta com qualquer servidor estático
npm run serve
```

## Desenvolvimento

O código-fonte fica em `src/main.ts`. Para recompilar após alterações:

```bash
npm install
npm run build   # ou: npm run watch
```

## Deploy na Vercel

O projeto é 100% estático (o `dist/main.js` já vem compilado e versionado), então não precisa de build na Vercel:

1. Importe o repositório em https://vercel.com/new.
2. Framework preset: **Other**.
3. Build Command e Install Command: deixe em branco (já configurados como `null` no `vercel.json`).
4. Output Directory: raiz do projeto (já configurado no `vercel.json`).
5. Deploy.

Se alterar `src/main.ts`, rode `npm run build` localmente e faça commit do `dist/main.js` atualizado antes do próximo deploy.

## Estrutura

```
index.html      # marcação e ponto de entrada
style.css       # estilos
src/main.ts     # lógica do jogo e renderização (TypeScript)
dist/main.js    # saída compilada (ES module), usada pelo index.html
tsconfig.json   # configuração do compilador TypeScript
vercel.json     # configuração de deploy estático na Vercel
.vercelignore   # arquivos de dev excluídos do deploy
```

## Licença

MIT
