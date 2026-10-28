window.FechamentoMensalComponent = function({ lancamentos, produtos, supabaseClient, companyId, onConcluido }) {
  const { useState, useEffect } = React;
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Filtra apenas os lançamentos que estão ATIVOS no painel atual
  const lancamentosAtivos = lancamentos.filter(l => l.status === 'ativo');

  useEffect(() => {
    carregarHistorico();
  }, [companyId]);

  async function carregarHistorico() {
    const { data } = await supabaseClient
      .from('fechamentos')
      .select('*')
      .eq('company_id', companyId)
      .order('data_fechamento', { ascending: false });
    if (data) setHistorico(data);
  }

  // Cálculos do extrato
  const faturamento = lancamentosAtivos.filter(l => l.tipo === 'Venda').reduce((acc, curr) => acc + Number(curr.valor_total), 0);
  const despesas = lancamentosAtivos.filter(l => l.tipo === 'Despesa').reduce((acc, curr) => acc + Number(curr.valor_total), 0);
  const lucro = lancamentosAtivos.filter(l => l.tipo === 'Venda').reduce((acc, curr) => acc + (Number(curr.valor_total) - Number(curr.custo_total)), 0) - despesas;
  
  const totalBebidas = lancamentosAtivos.filter(l => l.tipo === 'Venda' && l.canal_categoria === 'Bebidas').reduce((acc, curr) => acc + Number(curr.quantidade), 0);
  const totalPratos = lancamentosAtivos.filter(l => l.tipo === 'Venda' && l.canal_categoria !== 'Bebidas').reduce((acc, curr) => acc + Number(curr.quantidade), 0);

  // Cálculo de Ingredientes Usados
  let ingredientesUsados = {};
  lancamentosAtivos.filter(l => l.tipo === 'Venda').forEach(venda => {
    const prod = produtos.find(p => p.id === venda.produto_id);
    if (prod && Array.isArray(prod.ingredientes)) {
      prod.ingredientes.forEach(ing => {
        const num = parseFloat(ing.quantidade) || 1;
        const totalUsado = num * Number(venda.quantidade);
        const unidade = ing.quantidade.replace(/[0-9.,]/g, '').trim() || 'un';
        
        if (!ingredientesUsados[ing.nome]) {
          ingredientesUsados[ing.nome] = { qtd: 0, unidade: unidade, custoTotal: 0 };
        }
        ingredientesUsados[ing.nome].qtd += totalUsado;
        ingredientesUsados[ing.nome].custoTotal += (Number(ing.custo) * Number(venda.quantidade));
      });
    }
  });

  const arrayIngredientes = Object.entries(ingredientesUsados).sort((a, b) => b[1].qtd - a[1].qtd);

  async function realizarFechamento() {
    if (lancamentosAtivos.length === 0) {
      return alert("Não há lançamentos ativos para fechar neste mês.");
    }

    const dataAtual = new Date();
    const mesAno = `${dataAtual.getMonth() + 1}/${dataAtual.getFullYear()}`;
    const confirmacao = window.confirm(`Deseja encerrar o caixa e gerar o relatório do mês ${mesAno}? \nOs lançamentos atuais serão arquivados para iniciar o próximo mês zerado.`);
    
    if (!confirmacao) return;
    setCarregando(true);

    const relatorioJSON = {
      faturamento,
      despesas,
      lucro,
      totalBebidas,
      totalPratos,
      ingredientes: arrayIngredientes,
      qtdLancamentos: lancamentosAtivos.length
    };

    // 1. Salva o extrato
    const { error: errFechamento } = await supabaseClient.from('fechamentos').insert([{
      company_id: companyId,
      mes_ano: mesAno,
      relatorio: relatorioJSON
    }]);

    if (errFechamento) {
      alert("Erro ao gerar extrato: " + errFechamento.message);
      setCarregando(false);
      return;
    }

    // 2. Arquiva os lançamentos atuais para limpar o painel (muda o status)
    const idsParaArquivar = lancamentosAtivos.map(l => l.id);
    
    // Como o supabase tem limite de atualização em massa, atualizamos usando IN
    const { error: errUpdate } = await supabaseClient
      .from('lancamentos')
      .update({ status: 'arquivado' })
      .in('id', idsParaArquivar);

    if (errUpdate) {
      alert("Erro ao arquivar lançamentos: " + errUpdate.message);
    } else {
      alert("Fechamento do mês realizado com sucesso! O painel foi zerado para o próximo ciclo.");
      onConcluido(); // Atualiza o sistema
      carregarHistorico();
    }
    setCarregando(false);
  }

  return (
    <div className="max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Fechamento de Mês</h1>
        <p className="text-xs text-zinc-400">Gere o extrato financeiro e zere o caixa para o próximo mês.</p>
      </header>

      {/* QUADRO DE PRÉVIA DO FECHAMENTO */}
      <div className="bg-[#161616] border border-[#D95B1E]/50 rounded-xl p-6 shadow-[0_0_15px_rgba(217,91,30,0.1)] mb-8">
        <div className="flex items-center justify-between mb-6 border-b border-[#262626] pb-4">
          <h2 className="text-lg font-bold text-[#D95B1E] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
            Prévia do Mês Atual
          </h2>
          <span className="bg-[#202020] text-zinc-400 px-3 py-1 rounded text-xs font-mono">{lancamentosAtivos.length} registros pendentes</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#111111] p-4 rounded-lg border border-[#262626]">
            <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Faturamento</span>
            <span className="text-lg font-bold text-white block">R$ {faturamento.toFixed(2)}</span>
          </div>
          <div className="bg-[#111111] p-4 rounded-lg border border-[#262626]">
            <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Despesas</span>
            <span className="text-lg font-bold text-red-400 block">R$ {despesas.toFixed(2)}</span>
          </div>
          <div className="bg-[#111111] p-4 rounded-lg border border-[#262626]">
            <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Lucro Apurado</span>
            <span className="text-lg font-bold text-emerald-400 block">R$ {lucro.toFixed(2)}</span>
          </div>
          <div className="bg-[#111111] p-4 rounded-lg border border-[#262626]">
            <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Volume de Vendas</span>
            <span className="text-sm font-bold text-zinc-300 block">{totalPratos} Pratos | {totalBebidas} Bebidas</span>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Consumo de Ingredientes Previsto</h3>
          <div className="bg-[#111111] border border-[#262626] rounded-lg p-4 max-h-40 overflow-y-auto">
            {arrayIngredientes.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">Nenhuma ficha técnica vinculada às vendas.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                {arrayIngredientes.map(([nome, dados], idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs border-b border-[#202020] pb-1">
                    <span className="text-zinc-300">{nome}</span>
                    <span className="font-mono text-emerald-400">{dados.qtd} {dados.unidade} <span className="text-zinc-600 ml-1">(R$ {dados.custoTotal.toFixed(2)})</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-[#262626]">
          <button 
            onClick={realizarFechamento}
            disabled={carregando || lancamentosAtivos.length === 0}
            className="bg-[#D95B1E] hover:bg-[#c34e17] disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg text-sm transition-all shadow-md flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
            {carregando ? 'Processando...' : 'Encerrar Mês e Arquivar Lançamentos'}
          </button>
        </div>
      </div>

      {/* HISTÓRICO DE EXTRATOS */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Extratos Anteriores</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {historico.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">Nenhum fechamento realizado.</p>
          ) : (
            historico.map(extrato => (
              <div key={extrato.id} className="bg-[#161616] border border-[#262626] rounded-xl p-5 hover:border-zinc-600 transition-colors">
                <div className="flex justify-between items-center mb-3 border-b border-[#262626] pb-2">
                  <h3 className="font-bold text-white text-sm">Ref: {extrato.mes_ano}</h3>
                  <span className="text-[10px] text-zinc-500">{new Date(extrato.data_fechamento).toLocaleDateString()}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-zinc-400">Faturamento:</span><span className="text-white font-mono">R$ {Number(extrato.relatorio.faturamento).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Despesas:</span><span className="text-red-400 font-mono">R$ {Number(extrato.relatorio.despesas).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold pt-1 mt-1 border-t border-[#262626]"><span className="text-zinc-300">Lucro Final:</span><span className="text-emerald-400 font-mono">R$ {Number(extrato.relatorio.lucro).toFixed(2)}</span></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
