import { Elysia, MaybePromise } from 'elysia';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { cors } from '@elysiajs/cors';
import { Readable } from 'stream';
import { Room } from './models/Room';
import { Message } from './models/Message';
import { BASE_URL, CLIENT_URL, PORT } from './config';
import { connectDatabase } from './database';

dotenv.config({ path: '.env' });



// Adapter: Node.js IncomingMessage/ServerResponse <-> Fetch API Request/Response
function toNodeListener(handler: (req: Request) => MaybePromise<Response>) {
  return (req: IncomingMessage, res: ServerResponse) => {
    const clientOrigin = CLIENT_URL || 'http://localhost:3000';

    // OPTIONS isteği için preflight yanıtı ver
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': clientOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '',
        'Access-Control-Allow-Credentials': 'true',
      });
      res.end();
      return;
    }

    // Gelen relative URL'yi base URL ile birleştiriyoruz
    const url = req.url || '/';
    const absoluteUrl = new URL(url, BASE_URL).toString();

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.append(key, Array.isArray(value) ? value.join(',') : value);
      }
    }
    const method = req.method || 'GET';
    // GET/HEAD dışında, body'yi Node stream'ini Web stream'e dönüştürüp cast ediyoruz.
    const body =
      method === 'GET' || method === 'HEAD'
        ? null
        : (Readable.toWeb(req) as unknown as BodyInit);
    const request = new Request(absoluteUrl, { method, headers, body });

    Promise.resolve(handler(request))
      .then(async (response) => {
        // Yanıt headerlarına CORS bilgilerini ekle
        res.setHeader('Access-Control-Allow-Origin', clientOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        if (response.body) {
          const reader = response.body.getReader();
          function read() {
            reader.read().then(({ done, value }) => {
              if (done) {
                res.end();
                return;
              }
              res.write(Buffer.from(value));
              read();
            }).catch((err) => {
              res.setHeader('Access-Control-Allow-Origin', clientOrigin);
              res.setHeader('Access-Control-Allow-Credentials', 'true');
              res.statusCode = 500;
              res.end(err.toString());
            });
          }
          read();
        } else {
          res.end();
        }
      })
      .catch((err) => {
        res.setHeader('Access-Control-Allow-Origin', clientOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.statusCode = 500;
        res.end(err.toString());
      });
  };
}

await connectDatabase();


// Global Socket.io nesnesi için değişken
let io: SocketIOServer;

// Elysia uygulamasını oluştur
const app = new Elysia()
  .use(
    cors({
      origin: CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    })
  )
  .get('/', () => '✅ Server is running!')
  .post('/api/rooms', async ({ body }) => {
    try {
      const { name } = body as { name: string };
      const newRoom = await Room.create({ name });
      return newRoom;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
  })
  .get('/api/rooms', async () => {
    try {
      const rooms = await Room.find().lean();
      return rooms;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
  })
  .get('/api/rooms/:roomId/messages', async ({ params }) => {
    try {
      const { roomId } = params as { roomId: string };
      const messages = await Message.find({ roomId })
        .select('userId userName text createdAt avatar messageType teamId teamName teamAvatar')
        .sort({ createdAt: 1 })
        .lean();
      return messages;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
  })
  .post('/api/rooms/:roomId/messages', async ({ params, body }) => {
    try {
      const { roomId } = params as { roomId: string };
      const {
        text,
        userId,
        userName,
        avatar,
        messageType,
        teamId,
        teamName,
        teamAvatar,
      } = body as {
        text?: string;
        userId: string;
        userName: string;
        avatar: string;
        messageType: string;
        teamId?: string;
        teamName?: string;
        teamAvatar?: string;
      };

      const newMessage = {
        roomId,
        userId,
        userName,
        text,
        avatar,
        messageType,
        teamId,
        teamName,
        teamAvatar,
        createdAt: new Date().toISOString(),
      };

      // Socket.io ile mesajı anında gönder
      io.to(roomId).emit('receive_msg', newMessage);
      // Mesajı MongoDB'ye asenkron olarak kaydet
      Message.create(newMessage).catch(err => console.error("❌ DB Error:", err));

      return { success: true };
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
  });

// Adapter fonksiyonunu kullanarak Node request listener elde et
const nodeListener = toNodeListener(app.fetch);

// HTTP sunucusunu oluştur
const httpServer = createServer(nodeListener);

// Socket.io sunucusunu başlat (HTTP sunucusunu kullanarak)
io = new SocketIOServer(httpServer, {
  cors: {
    origin: CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Socket.io bağlantı yönetimi
io.on('connection', (socket) => {
  console.log(`✅ Kullanıcı bağlandı: ${socket.id}`);

  socket.on('join_room', (roomId: string) => {
    socket.join(roomId);
    console.log(`✅ Kullanıcı ${socket.id} odaya katıldı: ${roomId}`);
  });

  socket.on('send_msg', (msgData) => {
    io.to(msgData.roomId).emit('receive_msg', msgData);
    Message.create(msgData).catch(err => console.error("❌ DB Error:", err));
  });

  setInterval(() => {
    socket.emit('ping', { time: new Date().toISOString() });
  }, 10000);

  socket.on('pong', () => {
    console.log(`✅ Kullanıcıdan pong alındı: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Kullanıcı ayrıldı: ${socket.id}`);
  });
});


const port = parseInt(process.env.PORT || '5001', 10);

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`✅ Sunucu ${port} numaralı portta çalışıyor.`);
});

