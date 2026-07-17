const sala_input = document.getElementById('sala');
const sala_botao = document.getElementById('sala-botao');
const tela_i = document.getElementById('tela-inicial');
const jogo_i = document.getElementById('jogo-interface');
const nomeSala = document.getElementById('nomeSala');
const statusSimbolo = document.getElementById('status-seu-simbolo');
const celulas = document.querySelectorAll('.celula');
const botaoTema = document.getElementById('toggle-tema');

let socket;
let meuSimbolo = ""; 
let turnoAtual = ""; 
let partidaIniciada = false; // Controle limpo de fluxo de jogo

if (localStorage.getItem('theme') === 'light') {
    document.documentElement.classList.remove('dark');
    botaoTema.textContent = "🌙 Modo Escuro";
} else {
    document.documentElement.classList.add('dark');
    botaoTema.textContent = "☀️ Modo Claro";
}

botaoTema.addEventListener('click', () => {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        botaoTema.textContent = "🌙 Modo Escuro";
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        botaoTema.textContent = "☀️ Modo Claro";
    }
});

async function conectarSala() {
    let chave = sala_input.value.trim();
    if (chave === "") return alert("Por favor, digite uma sala!");

    if (!chave.startsWith("/")) chave = "/" + chave;

    const servidorHTTP = "https://whozap-server.onrender.com"; 
    const servidorURL = `wss://whozap-server.onrebatata.com${chave}`;
    
    try {
        sala_input.disabled = true;
        sala_botao.disabled = true;
        
        statusSimbolo.textContent = "Acordando o servidor no Render (pode levar 1 minuto)...";
        statusSimbolo.className = "text-sm text-blue-500 font-bold mb-4 h-5 text-center animate-pulse";

        await fetch(servidorHTTP, { mode: 'no-cors' }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 2000));

        socket = new WebSocket(servidorURL);
        configurarWebSocket();
        
        nomeSala.textContent = chave.replace("/", "");
    } catch (erro) {
        alert("Erro ao tentar conectar: " + erro.message);
        sala_input.disabled = false;
        sala_botao.disabled = false;
    }
}

function configurarWebSocket() {
    socket.onopen = () => {
        tela_i.classList.add("hidden");
        jogo_i.classList.remove("hidden");
        partidaIniciada = false; // Aguardando jogador 2
        statusSimbolo.textContent = "Aguardando o segundo jogador entrar...";
        statusSimbolo.className = "text-sm text-yellow-600 dark:text-yellow-400 mb-4 font-bold h-5 text-center";
        limparTodasAsCasas();
    };

    socket.onmessage = (event) => {
        const dadosRecebidos = JSON.parse(event.data);
        
        if (dadosRecebidos.erro) {
            alert(dadosRecebidos.erro);
            socket.close();
            return;
        }

        if (dadosRecebidos.tipo === "regras_iniciais") {
            meuSimbolo = dadosRecebidos.seuSimbolo;
            turnoAtual = dadosRecebidos.turno; 
        }

        if (dadosRecebidos.tipo === "sala_preenchida") {
            limparTodasAsCasas();
            partidaIniciada = true; // Libera a renderização do turno
            turnoAtual = dadosRecebidos.turno;
            atualizarTextoStatus();
        }

        if (dadosRecebidos.tipo === "atualizacao_jogada") {
            desenharSimbolo(dadosRecebidos.posicao, dadosRecebidos.simbolo);
            turnoAtual = dadosRecebidos.proximoTurno;
            atualizarTextoStatus();
        }

        if (dadosRecebidos.tipo === "fim_jogo") {
            desenharSimbolo(dadosRecebidos.posicao, dadosRecebidos.simbolo);
            turnoAtual = ""; 
            
            if (dadosRecebidos.vencedor === "empate") {
                statusSimbolo.textContent = "Deu velha! O jogo empatou. Reiniciando em 5s...";
                statusSimbolo.className = "text-sm text-gray-500 font-bold mb-4 h-5 text-center";
            } else {
                const venceu = dadosRecebidos.vencedor === meuSimbolo;
                statusSimbolo.textContent = venceu ? "🎉 Vitória! Você ganhou! Reiniciando em 5s..." : "❌ Derrota! Seu oponente ganhou. Reiniciando em 5s...";
                statusSimbolo.className = venceu ? "text-sm text-green-500 font-bold mb-4 h-5 text-center" : "text-sm text-red-500 font-bold mb-4 h-5 text-center";
                
                dadosRecebidos.linha.forEach(id => {
                    document.getElementById(id.toString()).classList.add("!text-green-500");
                });
            }
        }

        if (dadosRecebidos.tipo === "reiniciar_tabuleiro") {
            limparTodasAsCasas();
            partidaIniciada = true;
            turnoAtual = dadosRecebidos.turnoInicial;
            atualizarTextoStatus();
        }

        if (dadosRecebidos.tipo === "jogador_saiu") {
            limparTodasAsCasas();
            turnoAtual = "";
            partidaIniciada = false; // Bloqueia e volta para tela de espera
            alert("O outro jogador desconectou. Você foi promovido a Jogador 1 (O)!");
            statusSimbolo.textContent = "Aguardando o segundo jogador entrar...";
            statusSimbolo.className = "text-sm text-yellow-600 dark:text-yellow-400 mb-4 font-bold h-5 text-center";
        }
    };

    socket.onerror = () => {
        alert("Erro na conexão.");
        redefinirPainelInicial();
    };

    socket.onclose = () => {
        alert("Conexão encerrada.");
        redefinirPainelInicial();
    };
}

function atualizarTextoStatus() {
    if (!partidaIniciada) return; // Se não houver 2 jogadores, não renderiza texto de turno

    const seuTurno = meuSimbolo === turnoAtual;
    statusSimbolo.textContent = seuTurno ? "Sua vez de jogar!" : "Aguardando jogada do oponente...";
    statusSimbolo.className = seuTurno ? "text-sm text-green-500 dark:text-green-400 mb-4 font-bold h-5 text-center" : "text-sm text-yellow-600 dark:text-yellow-400 mb-4 font-bold h-5 text-center";
}

function limparTodasAsCasas() {
    celulas.forEach(celula => {
        celula.innerHTML = "";
        celula.classList.remove("text-blue-500", "dark:text-blue-400", "text-red-500", "dark:text-red-400", "!text-green-500");
    });
}

function redefinirPainelInicial() {
    tela_i.classList.remove("hidden");
    jogo_i.classList.add("hidden");
    sala_input.disabled = false;
    sala_botao.disabled = false;
    sala_input.value = "";
}

function desenharSimbolo(posicaoId, simbolo) {
    const botao = document.getElementById(posicaoId.toString());
    if (!botao) return;

    if (simbolo === "circulo") {
        botao.innerHTML = "O"; 
        botao.classList.add("text-blue-500", "dark:text-blue-400");
    } else if (simbolo === "xis") {
        botao.innerHTML = "X";
        botao.classList.add("text-red-500", "dark:text-red-400");
    }
}

celulas.forEach(celula => {
    celula.addEventListener('click', (e) => {
        const posicaoClicada = e.target.id;
        if (partidaIniciada && meuSimbolo === turnoAtual && e.target.innerHTML === "" && socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                tipo: "jogada",
                posicao: posicaoClicada
            }));
        }
    });
});

sala_input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") conectarSala();
});

sala_botao.addEventListener("click", conectarSala);
