import Ticket from "../models/Ticket.js";
import Counter from "../models/Counter.js";

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
    
    socket.on('call-ticket', async (data) => {
      try {
        const { ticket, counterId } = data;
        
        // Emit to counter
        io.to(`counter-${counterId}`).emit('ticket-called', ticket);
        
        // Emit to zone for public display
        if (ticket.zone) {
          io.to(`zone-${ticket.zone}`).emit('queue-update', {
            action: 'ticket-called',
            ticket
          });
        }
        
        // Trigger audio announcement
        io.emit('audio-announcement', {
          ticketNumber: ticket.displayNumber || ticket.ticketNumber.slice(-4),
          counterNumber: counterId
        });
        
        console.log(`Ticket ${ticket.ticketNumber} called to counter ${counterId}`);
      } catch (error) {
        console.error('Socket call-ticket error:', error);
      }
    });
    
    socket.on('complete-ticket', async (data) => {
      try {
        const { ticket, counterId } = data;
        
        io.to(`counter-${counterId}`).emit('ticket-completed', ticket);
        if (ticket.zone) {
          io.to(`zone-${ticket.zone}`).emit('queue-update', {
            action: 'ticket-completed',
            ticket
          });
        }
      } catch (error) {
        console.error('Socket complete-ticket error:', error);
      }
    });
    
    socket.on('absent-ticket', async (data) => {
      try {
        const { ticket, counterId } = data;
        
        io.to(`counter-${counterId}`).emit('ticket-absent', ticket);
        if (ticket.zone) {
          io.to(`zone-${ticket.zone}`).emit('queue-update', {
            action: 'ticket-absent',
            ticket
          });
        }
      } catch (error) {
        console.error('Socket absent-ticket error:', error);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};