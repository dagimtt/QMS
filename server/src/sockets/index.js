export const initializeSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join-counter', (counterId) => {
      socket.join(`counter-${counterId}`);
      console.log(`Socket ${socket.id} joined counter-${counterId}`);
    });
    
    socket.on('join-zone', (zoneId) => {
      socket.join(`zone-${zoneId}`);
      console.log(`Socket ${socket.id} joined zone-${zoneId}`);
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};