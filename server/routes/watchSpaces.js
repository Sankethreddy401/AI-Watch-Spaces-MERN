
const router = require('express').Router();
const { randomBytes } = require('crypto');

const WatchSpace = require('../models/WatchSpace');
const Title = require('../models/Title');
const Chat = require('../models/ChatMessage');
const SessionEvent = require('../models/SessionEvent');
const Interaction = require('../models/Interaction');
const { authenticate } = require('../middleware/auth');
const { answerQuestion } = require('../services/aiService');

router.use(authenticate);

// CREATE WATCH SPACE
router.post('/', async (req, res) => {
  try {
    const title = await Title.findById(req.body.titleId);

    if (!title) {
      return res.status(404).json({ message: 'Title not found' });
    }

    const room = await WatchSpace.create({
      titleId: title.id,
      hostUserId: req.user.id,
      name: req.body.name || `${title.name} Watch Party`,
      inviteCode: randomBytes(3).toString('hex').toUpperCase(),
      maxParticipants: Math.min(
        50,
        Math.max(2, Number(req.body.maxParticipants) || 25)
      ),
      aiVerbosity: req.body.aiVerbosity || 'normal',
      votingEnabled: req.body.votingEnabled !== false,
      privacy: req.body.privacy || 'invite-only',
      participants: [
        {
          userId: req.user.id,
          joinedAt: new Date()
        }
      ]
    });

    await SessionEvent.create({
      watchSpaceId: room.id,
      type: 'room.created',
      userId: req.user.id
    });

    res.status(201).json({
      watchSpaceId: room.id,
      inviteCode: room.inviteCode,
      status: room.status,
      hostUserId: room.hostUserId,
      createdAt: room.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not create Watch Space' });
  }
});

// JOIN WATCH SPACE
router.post('/join', async (req, res) => {
  try {
    const room = await WatchSpace.findOne({
      inviteCode: String(req.body.inviteCode || '').toUpperCase()
    });

    if (!room || room.status === 'ended') {
      return res.status(404).json({
        message: 'Watch Space not found or ended'
      });
    }

    if (room.locked) {
      return res.status(403).json({ message: 'Room is locked' });
    }

    const active = room.participants.filter(p => !p.leftAt);

    if (
      active.length >= room.maxParticipants &&
      !active.some(p => String(p.userId) === req.user.id)
    ) {
      return res.status(409).json({ message: 'Room is full' });
    }

    let participant = room.participants.find(
      p => String(p.userId) === req.user.id
    );

    if (participant) {
      participant.leftAt = null;
    } else {
      room.participants.push({
        userId: req.user.id,
        joinedAt: new Date()
      });
    }

    room.peakParticipants = Math.max(
      room.peakParticipants,
      room.participants.filter(p => !p.leftAt).length
    );

    await room.save();

    const title = await Title.findById(room.titleId);

    res.json({ room, title, playback: room.playback });
  } catch (error) {
    res.status(500).json({ message: 'Could not join Watch Space' });
  }
});

// MY WATCH SPACES
router.get('/mine', async (req, res) => {
  try {
    const rooms = await WatchSpace.find({
      'participants.userId': req.user.id
    })
      .populate('titleId', 'name posterUrl durationSeconds')
      .sort({ updatedAt: -1 })
      .limit(20);

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Could not load Watch Spaces' });
  }
});

// GET WATCH SPACE
router.get('/:id', async (req, res) => {
  try {
    const room = await WatchSpace.findById(req.params.id)
      .populate('titleId')
      .populate('participants.userId', 'displayName email');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const isParticipant = room.participants.some(
      p =>
        String(p.userId?._id || p.userId) === String(req.user.id) &&
        !p.leftAt
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: 'Join this room first'
      });
    }

    const messages = await Chat.find({
      watchSpaceId: room.id
    })
      .sort({ createdAt: 1 })
      .limit(100);

    res.json({ room, messages });
  } catch (error) {
    res.status(500).json({ message: 'Could not load Watch Space' });
  }
});

// AI QUESTION
router.post('/:id/ai/ask', async (req, res) => {
  try {
    const room = await WatchSpace.findById(req.params.id);

    if (
      !room ||
      !room.participants.some(
        p =>
          String(p.userId) === String(req.user.id) &&
          !p.leftAt
      )
    ) {
      return res.status(403).json({
        message: 'Room access required'
      });
    }

    const title = await Title.findById(room.titleId);

    const result = answerQuestion(
      title,
      String(req.body.question || '').slice(0, 500),
      Math.max(0, Number(req.body.currentTs) || 0)
    );

    const message = await Chat.create({
      watchSpaceId: room.id,
      msgType: 'ai_answer',
      body: result.answer,
      displayName: 'AI Co-Pilot',
      tsSeconds: req.body.currentTs
    });

    await SessionEvent.create({
      watchSpaceId: room.id,
      type: 'ai.question',
      userId: req.user.id,
      payload: {
        question: req.body.question,
        sourceEvents: result.sourceEvents
      }
    });

    res.json({
      ...result,
      messageId: message.id,
      generatedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ message: 'AI request failed' });
  }
});

// VOTING
router.post('/:id/vote', async (req, res) => {
  try {
    const room = await WatchSpace.findById(req.params.id);

    if (
      !room ||
      !room.votingEnabled ||
      !room.participants.some(
        p =>
          String(p.userId) === String(req.user.id) &&
          !p.leftAt
      )
    ) {
      return res.status(403).json({
        message: 'Voting unavailable or room access required'
      });
    }

    const title = await Title.findById(room.titleId);
    const event = title.timeline.id(req.body.eventId);

    if (!event || event.type !== 'variationPoint') {
      return res.status(404).json({
        message: 'Variation point not found'
      });
    }

    const option = event.options.find(
      o => o.id === req.body.optionId
    );

    if (!option) {
      return res.status(400).json({
        message: 'Invalid option'
      });
    }

    req.app.get('io').to(room.id).emit(
      'room.variation.applied',
      {
        variationId: event.variationId,
        winningOptionId: option.id,
        label: option.label
      }
    );

    await SessionEvent.create({
      watchSpaceId: room.id,
      type: 'variation.applied',
      userId: req.user.id,
      payload: {
        variationId: event.variationId,
        winningOptionId: option.id
      }
    });

    res.json({
      variationId: event.variationId,
      winningOptionId: option.id,
      label: option.label
    });
  } catch (error) {
    res.status(500).json({ message: 'Voting failed' });
  }
});

// END WATCH SPACE
router.post('/:id/end', async (req, res) => {
  try {
    const room = await WatchSpace.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (String(room.hostUserId) !== String(req.user.id)) {
      return res.status(403).json({
        message: 'Only the host can end this room'
      });
    }

    if (room.status !== 'ended') {
      room.status = 'ended';
      room.endedAt = new Date();
      room.playback.state = 'pause';

      await room.save();

      const title = await Title.findById(room.titleId);
      const active = room.participants.filter(p => !p.leftAt);

      for (const p of active) {
        await Interaction.findOneAndUpdate(
          {
            userId: p.userId,
            titleId: room.titleId
          },
          {
            $set: {
              watchedSeconds: room.playback.positionSeconds,
              completed:
                room.playback.positionSeconds >=
                (title?.durationSeconds || Infinity) * 0.9
            },
            $addToSet: {
              coWatchedWith: {
                $each: active
                  .filter(q => String(q.userId) !== String(p.userId))
                  .map(q => q.userId)
              }
            }
          },
          { upsert: true, new: true }
        );
      }

      await SessionEvent.create({
        watchSpaceId: room.id,
        type: 'room.ended'
      });

      req.app.get('io').to(room.id).emit('room.ended');
    }

    res.json({ message: 'Watch Space ended' });
  } catch (error) {
    res.status(500).json({ message: 'Could not end Watch Space' });
  }
});

// DELETE WATCH SPACE - HOST ONLY
router.delete('/:id', async (req, res) => {
  try {
    const room = await WatchSpace.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        message: 'Watch Space not found'
      });
    }

    if (String(room.hostUserId) !== String(req.user.id)) {
      return res.status(403).json({
        message: 'Only the host can delete this Watch Space'
      });
    }

    // Notify all connected participants
    req.app.get('io').to(room.id).emit('room.deleted');

    // Delete associated chat and session events
    await Chat.deleteMany({
      watchSpaceId: room.id
    });

    await SessionEvent.deleteMany({
      watchSpaceId: room.id
    });

    // Delete the room itself
    await WatchSpace.deleteOne({
      _id: room.id
    });

    res.json({
      message: 'Watch Space deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Could not delete Watch Space'
    });
  }
});

module.exports = router;
