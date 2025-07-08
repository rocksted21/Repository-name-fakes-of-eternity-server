// server.js - Servidor para Render.com - Fakes of Eternity
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ============ CORS E MIDDLEWARE ============
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    
    // CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Max-Age', '3600');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.text());
app.use(express.urlencoded({ extended: true }));

// ============ DADOS EM MEMÓRIA ============
let waitingPlayers = [];
let matches = [];
let playerSessions = new Map();
let serverStats = {
    startTime: new Date(),
    totalConnections: 0,
    matchesCreated: 0
};

// ============ PÁGINA INICIAL ============
app.get('/', (req, res) => {
    console.log('🏠 GET / - Página inicial acessada');
    serverStats.totalConnections++;
    
    res.json({
        message: "🎮 Fakes of Eternity - Matchmaking Server",
        status: "online",
        platform: "Render.com",
        version: "2.0",
        waitingPlayers: waitingPlayers.length,
        activeSessions: playerSessions.size,
        uptime: Math.floor((Date.now() - serverStats.startTime.getTime()) / 1000),
        timestamp: new Date().toISOString(),
        endpoints: [
            "GET / - Status do servidor",
            "GET /test - Teste simples",
            "POST /test - Teste POST",
            "POST /matchmaking/join - Entrar na fila",
            "GET /matchmaking/status/:playerId - Verificar status",
            "POST /matchmaking/leave - Sair da fila",
            "GET /stats - Estatísticas detalhadas"
        ]
    });
});

// ============ ENDPOINTS DE TESTE ============
app.get('/test', (req, res) => {
    console.log('🧪 GET /test - Teste acessado');
    res.json({
        success: true,
        message: "Servidor Render funcionando perfeitamente!",
        method: req.method,
        timestamp: new Date().toISOString(),
        server: "Render.com",
        cors: "Configurado"
    });
});

app.post('/test', (req, res) => {
    console.log('🧪 POST /test - Teste POST');
    console.log('Body recebido:', req.body);
    
    res.json({
        success: true,
        message: "POST no Render funcionando!",
        receivedData: req.body,
        timestamp: new Date().toISOString(),
        server: "Render.com"
    });
});

// ============ MATCHMAKING ============
app.post('/matchmaking/join', (req, res) => {
    console.log('🎯 POST /matchmaking/join');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    try {
        const { playerId, heroName, nickname } = req.body || {};
        
        // Validações
        if (!playerId) {
            console.log('❌ playerId missing');
            return res.status(400).json({ 
                success: false, 
                error: "playerId é obrigatório",
                received: req.body
            });
        }

        if (!heroName) {
            console.log('❌ heroName missing');
            return res.status(400).json({ 
                success: false, 
                error: "heroName é obrigatório",
                received: req.body
            });
        }

        // Remove player anterior se existir
        waitingPlayers = waitingPlayers.filter(p => p.id !== playerId);
        
        const player = {
            id: playerId,
            heroName: heroName,
            nickname: nickname || "Player",
            joinedAt: Date.now(),
            ipAddress: req.ip || req.connection.remoteAddress
        };
        
        console.log('👤 Player criado:', player);
        
        // Procura por oponente
        if (waitingPlayers.length > 0) {
            const opponent = waitingPlayers.shift();
            const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            console.log(`🎉 MATCH ENCONTRADO! ${player.nickname} vs ${opponent.nickname}`);
            console.log(`📊 Match ID: ${matchId}`);
            
            // Incrementa contador
            serverStats.matchesCreated++;
            
            // Salva sessão para o oponente que estava esperando
            playerSessions.set(opponent.id, {
                matchId: matchId,
                opponent: {
                    id: player.id,
                    nickname: player.nickname,
                    heroName: player.heroName
                },
                playerNumber: 1,
                createdAt: Date.now()
            });
            
            // Resposta para o player atual (que acabou de entrar)
            res.json({
                success: true,
                matchFound: true,
                matchId: matchId,
                opponent: {
                    id: opponent.id,
                    nickname: opponent.nickname,
                    heroName: opponent.heroName
                },
                playerNumber: 2,
                gameConfig: {
                    maxPlayers: 2,
                    gameMode: "pvp",
                    mapName: "main1_dividido32x32"
                }
            });
            
        } else {
            // Adiciona à fila de espera
            waitingPlayers.push(player);
            console.log(`⏳ Player adicionado à fila. Total esperando: ${waitingPlayers.length}`);
            
            res.json({
                success: true,
                matchFound: false,
                queuePosition: waitingPlayers.length,
                waitTime: 0,
                message: "Procurando oponente... Aguarde!"
            });
        }
        
    } catch (error) {
        console.error('💥 Erro no matchmaking:', error);
        res.status(500).json({ 
            success: false, 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// ============ STATUS DA FILA ============
app.get('/matchmaking/status/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    console.log(`🔍 GET /matchmaking/status/${playerId}`);
    
    try {
        // Verifica se tem sessão (match encontrado)
        if (playerSessions.has(playerId)) {
            const session = playerSessions.get(playerId);
            playerSessions.delete(playerId); // Remove após entregar
            
            console.log(`✅ Sessão encontrada para ${playerId}:`, session);
            
            res.json({
                success: true,
                matchFound: true,
                matchId: session.matchId,
                opponent: session.opponent,
                playerNumber: session.playerNumber,
                gameConfig: {
                    maxPlayers: 2,
                    gameMode: "pvp",
                    mapName: "main1_dividido32x32"
                }
            });
            return;
        }
        
        // Verifica se está na fila
        const playerInQueue = waitingPlayers.find(p => p.id === playerId);
        if (playerInQueue) {
            const position = waitingPlayers.indexOf(playerInQueue) + 1;
            const waitTime = Date.now() - playerInQueue.joinedAt;
            
            console.log(`⏳ Player ${playerId} na posição ${position}, esperando ${waitTime}ms`);
            
            res.json({
                success: true,
                matchFound: false,
                queuePosition: position,
                waitTime: waitTime,
                message: `Posição ${position} na fila. Procurando oponente...`
            });
            return;
        }
        
        // Player não encontrado
        console.log(`❓ Player ${playerId} não encontrado`);
        res.status(404).json({
            success: false,
            error: "Player não encontrado na fila"
        });
        
    } catch (error) {
        console.error('💥 Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            error: "Erro interno ao verificar status"
        });
    }
});

// ============ SAIR DA FILA ============
app.post('/matchmaking/leave', (req, res) => {
    console.log('🚪 POST /matchmaking/leave');
    console.log('Body:', req.body);
    
    try {
        const { playerId } = req.body || {};
        
        if (playerId) {
            const initialLength = waitingPlayers.length;
            waitingPlayers = waitingPlayers.filter(p => p.id !== playerId);
            playerSessions.delete(playerId);
            
            const removed = initialLength > waitingPlayers.length;
            console.log(`👋 Player ${playerId} ${removed ? 'removido' : 'não estava'} da fila`);
        }
        
        res.json({
            success: true,
            message: "Removido da fila com sucesso"
        });
        
    } catch (error) {
        console.error('💥 Erro ao sair da fila:', error);
        res.status(500).json({
            success: false,
            error: "Erro interno ao sair da fila"
        });
    }
});

// ============ ESTATÍSTICAS ============
app.get('/stats', (req, res) => {
    console.log('📊 GET /stats');
    
    const uptime = Math.floor((Date.now() - serverStats.startTime.getTime()) / 1000);
    
    res.json({
        server: "Fakes of Eternity Matchmaking",
        platform: "Render.com",
        status: "online",
        version: "2.0",
        uptime: uptime,
        uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
        stats: {
            totalConnections: serverStats.totalConnections,
            matchesCreated: serverStats.matchesCreated,
            currentWaitingPlayers: waitingPlayers.length,
            activeSessions: playerSessions.size
        },
        queue: waitingPlayers.map(p => ({
            id: p.id.substr(0, 15) + "...", // Trunca ID para privacidade
            nickname: p.nickname,
            heroName: p.heroName,
            waitTimeMs: Date.now() - p.joinedAt
        })),
        startTime: serverStats.startTime.toISOString(),
        timestamp: new Date().toISOString()
    });
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
    res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - serverStats.startTime.getTime()) / 1000)
    });
});

// ============ ROTAS NÃO ENCONTRADAS ============
app.use('*', (req, res) => {
    console.log(`❓ ${req.method} ${req.originalUrl} - Rota não encontrada`);
    res.status(404).json({
        error: "Rota não encontrada",
        method: req.method,
        url: req.originalUrl,
        available: [
            "GET / - Status do servidor",
            "GET /test - Teste simples",
            "POST /test - Teste POST", 
            "POST /matchmaking/join - Entrar na fila",
            "GET /matchmaking/status/:playerId - Verificar status",
            "POST /matchmaking/leave - Sair da fila",
            "GET /stats - Estatísticas",
            "GET /health - Health check"
        ]
    });
});

// ============ TRATAMENTO DE ERROS ============
app.use((error, req, res, next) => {
    console.error('💥 Erro não tratado:', error);
    res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        message: error.message
    });
});

// ============ LIMPEZA PERIÓDICA ============
setInterval(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutos
    
    // Remove players antigos da fila
    const initialLength = waitingPlayers.length;
    waitingPlayers = waitingPlayers.filter(p => now - p.joinedAt < timeout);
    
    // Remove sessões antigas
    const initialSessions = playerSessions.size;
    for (const [playerId, session] of playerSessions.entries()) {
        if (now - session.createdAt > timeout) {
            playerSessions.delete(playerId);
        }
    }
    
    if (initialLength !== waitingPlayers.length || initialSessions !== playerSessions.size) {
        console.log(`🧹 Limpeza: ${initialLength - waitingPlayers.length} players e ${initialSessions - playerSessions.size} sessões removidas`);
    }
}, 2 * 60 * 1000); // Executa a cada 2 minutos

// ============ INICIALIZAÇÃO ============
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando no Render.com na porta ${PORT}`);
    console.log(`📡 Endpoints disponíveis:`);
    console.log(`   GET  / - Status do servidor`);
    console.log(`   GET  /test - Teste simples`);
    console.log(`   POST /test - Teste POST`);
    console.log(`   POST /matchmaking/join - Entrar na fila`);
    console.log(`   GET  /matchmaking/status/:id - Verificar status`);
    console.log(`   POST /matchmaking/leave - Sair da fila`);
    console.log(`   GET  /stats - Estatísticas`);
    console.log(`   GET  /health - Health check`);
    console.log(`🕐 Servidor iniciado em: ${serverStats.startTime.toISOString()}`);
});

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM recebido, desligando servidor...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
});
