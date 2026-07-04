# Guia de instalacao do ZuBlock

ZuBlock e uma build alpha, descompactada e experimental. Ela foi feita para
teste publico em navegadores baseados em Chromium, usando Manifest V3.

## Antes de instalar

- **Nao instale direto do zip.** Primeiro extraia o arquivo.
- **Nao apague nem mova a pasta depois de carregar a extensao.** O navegador
  continua lendo a extensao daquele lugar.
- **Nao precisa Tampermonkey.** O ZuBlock roda como extensao propria.
- **Se voce usa outro bloqueador de anuncios**, desative temporariamente para
  testar o ZuBlock sem conflito.
- **A traducao vem desligada por padrao.** Voce ativa no menu do ZuBlock.
- **O Escudo Twitch e experimental.** Se o player travar ou mostrar erro #2000,
  desligue o Escudo Twitch no popup e recarregue a pagina.

## Navegadores compativeis

Funciona melhor em navegadores Chromium com suporte a Manifest V3:

| Navegador | Pagina de extensoes | Status |
| --- | --- | --- |
| Brave | `brave://extensions` | Recomendado para o teste atual |
| Google Chrome | `chrome://extensions` | Compativel |
| Microsoft Edge | `edge://extensions` | Compativel |
| Opera / Opera GX | `opera://extensions` | Compativel, mas pode variar por versao |
| Chromium / Vivaldi | `chrome://extensions` ou pagina equivalente | Provavel, sem garantia |

Nao e a build certa para Firefox ou Safari. Esta pasta e para Chromium MV3.

## Instalacao pela release do GitHub

1. Abra a pagina de releases:
   <https://github.com/ExtremestoneGG/ZuBlock/releases/latest>
2. Baixe o arquivo `ZuBlockMV3-*.zip`.
3. Extraia o zip para uma pasta fixa. Exemplo:

   ```text
   D:\ZuBlockMV3
   ```

4. Abra a pagina de extensoes do seu navegador:

   ```text
   brave://extensions
   chrome://extensions
   edge://extensions
   opera://extensions
   ```

5. Ative `Modo do desenvolvedor`.
6. Clique em `Carregar sem compactacao`, `Load unpacked` ou nome parecido.
7. Selecione a pasta extraida, por exemplo `D:\ZuBlockMV3`.
8. Fixe o icone do ZuBlock na barra do navegador.
9. Abra um site comum e clique no icone roxo do ZuBlock para confirmar que o
   popup abriu com o nome do site.

## Instalacao nesta maquina

Nesta maquina, a pasta local pronta para carregar esta aqui:

```text
D:\ZuBlockMV3
```

No Brave, abra:

```text
brave://extensions
```

Depois ative `Modo do desenvolvedor`, clique em `Carregar sem compactacao` e
selecione `D:\ZuBlockMV3`.

## Como atualizar depois

Quando sair uma build nova:

1. Feche as abas de teste se quiser evitar conflito durante a troca.
2. Substitua a pasta antiga pela nova pasta extraida.
3. Volte em `brave://extensions`, `chrome://extensions`, `edge://extensions`
   ou `opera://extensions`.
4. Clique no botao de recarregar do card do ZuBlock.
5. Abra um site e confira se o popup continua abrindo.

Se voce apagar a pasta da extensao, o navegador pode desativar o ZuBlock.

## O que vem incluso

### Bloqueio de conteudo

Mantem a base do uBlock Origin/uBOLite para Manifest V3, com listas de filtros,
bloqueio de anuncios, rastreadores, popups e dominios indesejados.

### Edicoes salvas

Serve para esconder partes de um site de forma permanente.

Fluxo recomendado:

1. Abra o site.
2. Abra o popup do ZuBlock.
3. Use `Apagar agora` para remover um elemento visual da pagina.
4. Quando o botao de salvar ficar disponivel, clique em `Salvar edicao`.
5. Na proxima visita ao mesmo site, o ZuBlock tenta reaplicar a remocao durante
   o carregamento, para o elemento ja sumir cedo.
6. Para desfazer, abra `Revisar salvos` e remova a edicao daquele site.

Isso e util para limpar banners, caixas repetidas, blocos de recomendacao,
avisos visuais e partes de interface que atrapalham acessibilidade.

### Traducao visual

Traduz textos visiveis da pagina para portugues ou ingles. A funcao fica
desligada por padrao para nao alterar sites sem permissao do usuario.

Opcoes principais:

- `Ativar traducao`: liga a traducao visual na pagina atual.
- `Idioma`: escolhe portugues ou ingles.
- `Salvar traducao`: guarda traducoes repetidas em cache local para acelerar
  visitas futuras.
- `Desativar`: volta a navegar sem traduzir visualmente a pagina.

A qualidade tenta ser alta usando uma cascata: primeiro a API nativa do
navegador quando existir, depois um endpoint web de traducao como fallback.

### Escudo Twitch

O Escudo Twitch e uma protecao experimental para lives da Twitch. Ele tenta
reduzir anuncios de livestream usando regras de proxy para algumas requisicoes
de playlist e video da Twitch, inspirado na abordagem publica do TTV LOL PRO.

O que voce precisa saber:

- pode funcionar em uma live e falhar em outra;
- pode quebrar quando a Twitch muda algo;
- pode causar erro de player, inclusive erro #2000;
- pode conflitar com VPN, proxy ou outra extensao de bloqueio;
- fica no popup para voce desligar rapido.

Se uma live quebrar:

1. Abra o popup do ZuBlock.
2. Desligue `Escudo Twitch`.
3. Recarregue a pagina da Twitch.
4. Teste de novo depois, porque isso depende das rotas da Twitch no momento.

### Brave Clean

Extensoes nao podem editar diretamente paginas internas do navegador, a nova
guia nativa, a toolbar do Brave ou `brave://settings`. Por isso, o Brave Clean
funciona como uma area de atalhos e orientacao para configuracoes que precisam
ser feitas pelo proprio usuario no navegador.

## Como testar e reportar

Quando for mandar para outras pessoas testarem, peca para elas informarem:

- navegador e versao;
- sistema operacional;
- se instalou por zip extraido ou por pasta local;
- site em que deu problema;
- se havia outro adblock, VPN ou proxy ligado;
- print do erro, se aparecer;
- se o Escudo Twitch estava ligado ou desligado.

## Problemas comuns

### "Manifest file is missing or unreadable"

Voce provavelmente selecionou a pasta errada. Selecione a pasta que contem o
arquivo `manifest.json`, nao a pasta acima dela e nao o zip.

### "Esta extensao foi desativada porque nao e mais compativel"

Isso costuma acontecer com forks Manifest V2 em Chromium moderno. O ZuBlock
testavel aqui usa a pasta MV3 `D:\ZuBlockMV3` ou o zip `ZuBlockMV3-*.zip`.

### O nome aparece como um monte de letras

Recarregue a extensao. Esta build corrige o popup para mostrar `ZuBlock` quando
o proprio popup/extension page estiver aberto.

### A Twitch mostrou anuncio

O Escudo Twitch ainda e tentativa alpha. A versao atual melhorou as categorias
de host usadas, mas nao existe garantia de bloquear todos os anuncios da Twitch.

### O player da Twitch deu erro #2000

Desligue o Escudo Twitch, recarregue a pagina e teste novamente. Esse erro pode
aparecer quando a rota de video/proxy entra em conflito com a sessao atual.

## Fontes uteis

- Chrome explica o carregamento de extensoes descompactadas em
  `chrome://extensions` com `Developer mode`.
- Microsoft Edge documenta o sideload local para testar extensoes antes de
  publicar na loja.
- Opera documenta o fluxo de `Developer Mode` e carregamento local de extensoes.

Links:

- <https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world>
- <https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading>
- <https://help.opera.com/en/extensions/basics/>
