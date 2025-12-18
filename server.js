const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');
const Sentiment = require('sentiment');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const sentiment = new Sentiment();

app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data.json');

// 如果没有数据文件，创建一个空的
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// 添加文本分类函数
function categorizeInput(text) {
    // 测试性文字
    if (/^(test|asdf|qwer|123|aaa)/i.test(text)) return 'test';
    // 重复符号
    if (/^(.)\1{2,}$/.test(text)) return 'repetitive';
    // 单字母/单字
    if (text.length === 1) return 'minimal';
    // 常见词汇
    if (text.split(' ').length > 2) return 'expressive';
    // 默认
    return 'neutral';
}

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // 1. 初始化：新用户进来时，把历史数据全部发给他
    const historyData = JSON.parse(fs.readFileSync(DATA_FILE));
    socket.emit('load_history', historyData);

    // 2. 监听：接收用户提交的新阈值
    socket.on('submit_threshold', (data) => {
        console.log('>>> Received data:', data);
        
        const currentData = JSON.parse(fs.readFileSync(DATA_FILE));
        
        // 分析输入文字的情感
        const analysis = sentiment.analyze(data.word);
        
        const newEntry = {
            id: socket.id,
            timestamp: Date.now(),
            word: data.word,
            params: {
                density: parseFloat(data.density),
                repetition: parseInt(data.repetition),
                distortion: parseFloat(data.distortion),
            },
            // 文本分析结果
            analysis: {
                sentiment: analysis.comparative,
                wordCount: analysis.tokens.length,
                hasEmotionalWords: analysis.words.length > 0,
                category: categorizeInput(data.word)
            }
        };

        currentData.push(newEntry);
        fs.writeFileSync(DATA_FILE, JSON.stringify(currentData, null, 2));

        io.emit('new_data_point', newEntry);
    });

    // 3. 删除所有数据
    socket.on('clear_all_data', () => {
        console.log('>>> Clearing all data');
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
        io.emit('data_cleared');
    });

    // 4. 删除单个数据
    socket.on('delete_entry', (timestamp) => {
        console.log('>>> Deleting entry:', timestamp);
        const currentData = JSON.parse(fs.readFileSync(DATA_FILE));
        const filtered = currentData.filter(item => item.timestamp !== timestamp);
        fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2));
        io.emit('entry_deleted', timestamp);
    });
});

server.listen(3000, () => {
    console.log('>>> MACHINE RUNNING ON http://localhost:3000');
});