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

    // Lembre-se de alterar para o link seguro do seu Render quando fizer deploy final!
    const servidorHTTP = "https://whozap-server.onrender.com"; 
    const servidorURL = `wss://://whozap-server.onrender.com${chave}`;
    
    try {
        sala_input.disabled = true;
        sala_botao.disabled = true;
        sala_input.placeholder = "Conectando ao servidor...";

        await fetch(servidorHTTP, { mode: 'no-cors' }).catch(() => {});

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
        statusSimbolo.textContent = "Aguardando o segundo jogador entrar...";
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
            // Garante que se o jogador foi promovido com a sala aberta, o status se atualize
            if(turnoAtual) atualizarTextoStatus(); 
        }

        if (dadosRecebidos.tipo === "sala_preenchida") {
            limparTodasAsCasas();
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
                statusSimbolo.textContent = "Deu velha! O jogo empatou.";
                statusSimbolo.className = "text-sm text-gray-500 font-bold mb-4 h-5 text-center";
            } else {
                const venceu = dadosRecebidos.vencedor === meuSimbolo;
                statusSimbolo.textContent = venceu ? "🎉 Vitória! Você ganhou!" : "❌ Derrota! Seu oponente ganhou.";
                statusSimbolo.className = venceu ? "text-sm text-green-500 font-bold mb-4 h-5 text-center" : "text-sm text-red-500 font-bold mb-4 h-5 text-center";
                
                dadosRecebidos.linha.forEach(id => {
                    document.getElementById(id.toString()).classList.add("!text-green-500");
                });
            }

            // ADICIONA O AVISO VISUAL DO CONTADOR DE TEMPO
            statusSimbolo.textContent += " Reiniciando em 5s...";
        }

        // ESCUTA O COMANDO DE RESET AUTOMÁTICO ENVIADO PELO SERVIDOR
        if (dadosRecebidos.tipo === "reiniciar_tabuleiro") {
            limparTodasAsCasas();
            turnoAtual = dadosRecebidos.turnoInicial;
            atualizarTextoStatus();
        }

        if (dadosRecebidos.tipo === "jogador_saiu") {
            limparTodasAsCasas();
            turnoAtual = "";
            alert("O outro jogador desconectou. Você foi promovido a Jogador 1 (O)!");
            statusSimbolo.textContent = "Aguardando um novo oponente entrar...";
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

function desenhoSimboloCompleto(posicaoId, simbolo) {
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
const desenharSimbolo = desenhoSimboloCompleto;

celulas.forEach(celula => {
    celula.addEventListener('click', (e) => {
        const posicaoClicada = e.target.id;
        if (meuSimbolo === turnoAtual && e.target.innerHTML === "" && socket && socket.readyState === 1) {
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
