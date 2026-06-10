# Aurum Calc

Calculadora estática para estimar custos de fabricação de joias em ouro. A aplicação compara pesos e considera ouro, liga, perda de material e mão de obra em dois cenários:

- ouro comprado para estimar o peso final;
- peso final desejado para estimar o ouro necessário.

## Recursos

- atualização automática dos cálculos;
- pesos personalizados e comparação em tabela;
- resumo de menor e maior orçamento;
- exportação CSV e impressão em PDF;
- link compartilhável com todos os parâmetros;
- persistência local e tema claro/escuro;
- layout responsivo e acessível;
- funcionamento sem backend ou bibliotecas externas.

## Desenvolvimento local

Abra `index.html` diretamente no navegador. Para servir por HTTP, use qualquer servidor estático, por exemplo:

```powershell
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Testes

Requer Node.js 20 ou superior.

```powershell
npm test
```

Os testes cobrem as fórmulas dos dois cenários, normalização de pesos e validação do estado salvo.

## Publicação

O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) executa os testes, monta um artefato apenas com os arquivos públicos e publica no GitHub Pages a cada push na branch `main`.

No repositório do GitHub, configure **Settings > Pages > Build and deployment > Source** como **GitHub Actions**. Depois disso, cada push em `main` atualiza a página automaticamente.
