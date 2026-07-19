const express = require('express');
const router = express.Router();
const axios = require('axios');
const Alert = require('../models/Alert');
const User = require('../models/User');
const Broadcast = require('../models/Broadcast');
const { protect } = require('../middleware/auth');
const authority = require('../middleware/authority');

// Protect all routes in this file with Auth + Authority checks
router.use(protect);
router.use(authority);

// ==============================================
// @route   GET /api/authority/alerts
// ==============================================
router.get('/alerts', async (req, res) => {
  try {
    const { status, type, limit } = req.query;
    const filters = {};
    if (status && status !== 'all') {
      filters.status = status;
    }
    if (type && type !== 'all') {
      filters.type = type;
    }
    const limitVal = parseInt(limit, 10) || 50;

    const alerts = await Alert.find(filters)
      .populate('reportedBy', 'name email role credibilityScore alertsReported')
      .sort({ createdAt: -1 })
      .limit(limitVal);

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Get authority alerts error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching alerts'
    });
  }
});

// ==============================================
// @route   GET /api/authority/analytics
// ==============================================
router.get('/analytics', async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const total_alerts_today = await Alert.countDocuments({ createdAt: { $gte: startOfToday } });
    const total_alerts_week = await Alert.countDocuments({ createdAt: { $gte: startOfWeek } });
    const total_alerts_all = await Alert.countDocuments({});

    const verified_count = await Alert.countDocuments({ status: 'verified' });
    const unverified_count = await Alert.countDocuments({ status: 'unverified' });
    const flagged_count = await Alert.countDocuments({ status: 'flagged' });

    const verification_rate = total_alerts_all > 0 ? Math.round((verified_count / total_alerts_all) * 100) : 0;

    // Group by alert category
    const types = ['flood', 'fire', 'accident', 'gas_leak', 'medical', 'earthquake', 'other'];
    const alerts_by_type = {};
    for (const t of types) {
      alerts_by_type[t] = await Alert.countDocuments({ type: t });
    }

    // Group by hour (last 24 hours of logs)
    const allAlerts = await Alert.find({});
    const alerts_by_hour = Array(24).fill(0);
    for (const alert of allAlerts) {
      const hr = new Date(alert.createdAt).getHours();
      if (hr >= 0 && hr < 24) {
        alerts_by_hour[hr]++;
      }
    }

    // Top reporters ranked by credibility score
    const top_reporters = await User.find({ role: 'citizen' })
      .sort({ credibilityScore: -1 })
      .limit(5)
      .select('name credibilityScore alertsReported');

    // Cluster coordinates by 1.5km proximity
    const clusters = [];
    for (const alert of allAlerts) {
      if (!alert.location || !alert.location.coordinates) continue;
      const [lng, lat] = alert.location.coordinates;
      let added = false;
      for (const cluster of clusters) {
        const dist = Math.sqrt(Math.pow(cluster.lat - lat, 2) + Math.pow(cluster.lng - lng, 2));
        if (dist < 0.015) {
          cluster.coords.push([lng, lat]);
          cluster.lat = cluster.coords.reduce((sum, c) => sum + c[1], 0) / cluster.coords.length;
          cluster.lng = cluster.coords.reduce((sum, c) => sum + c[0], 0) / cluster.coords.length;
          cluster.count += 1;
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push({
          lat,
          lng,
          coords: [[lng, lat]],
          count: 1
        });
      }
    }
    clusters.sort((a, b) => b.count - a.count);
    const most_active_zones = clusters.slice(0, 5).map(c => [c.lat, c.lng]);

    res.status(200).json({
      success: true,
      analytics: {
        total_alerts_today,
        total_alerts_week,
        total_alerts_all,
        verified_count,
        unverified_count,
        flagged_count,
        verification_rate,
        alerts_by_type,
        alerts_by_hour,
        top_reporters,
        most_active_zones
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating analytics'
    });
  }
});

// ==============================================
// @route   PUT /api/authority/alerts/:id/verify
// ==============================================
router.put('/alerts/:id/verify', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    alert.status = 'verified';
    alert.credibilityScore = 95;
    alert.grievances = []; // Clear pending citizen complaints/grievances
    await alert.save();

    // Reward reporter credibility score
    const reporter = await User.findById(alert.reportedBy);
    if (reporter) {
      reporter.credibilityScore = Math.min(100, (reporter.credibilityScore || 0) + 5);
      await reporter.save();
    }

    // Call Python scoring service feedback
    try {
      await axios.post(`${process.env.AI_SERVICE_URL || "http://localhost:5001"}/feedback`, {
        alert_id: alert._id.toString(),
        feedback_type: 'genuine',
        factors_used: alert.factors || {}
      });
    } catch (pythonErr) {
      console.error('Python scoring feedback api error:', pythonErr.message);
    }

    const updatedAlert = await Alert.findById(alert._id)
      .populate('reportedBy', 'name email role credibilityScore alertsReported')
      .populate('corroborations', 'name');

    // Emit live update socket
    const io = req.app.get('io');
    if (io) {
      io.emit('alert_updated', updatedAlert);
    }

    res.status(200).json({
      success: true,
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Verify alert error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying alert'
    });
  }
});

// ==============================================
// @route   PUT /api/authority/alerts/:id/dismiss
// ==============================================
router.put('/alerts/:id/dismiss', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    alert.status = 'flagged';
    alert.isActive = false;
    alert.grievances = []; // Clear grievances as the alert has now been processed
    await alert.save();

    // Penalize reporter credibility score
    const reporter = await User.findById(alert.reportedBy);
    if (reporter) {
      reporter.credibilityScore = Math.max(0, (reporter.credibilityScore || 0) - 10);
      await reporter.save();
    }

    // Call Python scoring service feedback
    try {
      await axios.post(`${process.env.AI_SERVICE_URL || "http://localhost:5001"}/feedback`, {
        alert_id: alert._id.toString(),
        feedback_type: 'false',
        factors_used: alert.factors || {}
      });
    } catch (pythonErr) {
      console.error('Python scoring feedback api error:', pythonErr.message);
    }

    const updatedAlert = await Alert.findById(alert._id)
      .populate('reportedBy', 'name email role credibilityScore alertsReported')
      .populate('corroborations', 'name');

    // Emit live update socket
    const io = req.app.get('io');
    if (io) {
      io.emit('alert_updated', updatedAlert);
    }

    res.status(200).json({
      success: true,
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Dismiss alert error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while dismissing alert'
    });
  }
});

// ==============================================
// @route   PUT /api/authority/alerts/:id/escalate
// ==============================================
router.put('/alerts/:id/escalate', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    alert.status = 'verified';
    alert.escalated = true;
    alert.credibilityScore = 100;
    await alert.save();

    const updatedAlert = await Alert.findById(alert._id)
      .populate('reportedBy', 'name email role credibilityScore alertsReported')
      .populate('corroborations', 'name');

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('alert_updated', updatedAlert);
      io.emit('alert_escalated', updatedAlert);
    }

    res.status(200).json({
      success: true,
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Escalate alert error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while escalating alert'
    });
  }
});

// ==============================================
// @route   POST /api/authority/broadcast
// ==============================================
router.post('/broadcast', async (req, res) => {
  try {
    const { message, zone_lat, zone_lng, zone_radius } = req.body;
    if (!message || !zone_lat || !zone_lng || !zone_radius) {
      return res.status(400).json({
        success: false,
        message: 'Missing message or zone details'
      });
    }

    const latVal = parseFloat(zone_lat);
    const lngVal = parseFloat(zone_lng);
    const radiusVal = parseFloat(zone_radius);

    // Query user locations within the selected radius sphere
    const users = await User.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [lngVal, latVal]
          },
          $maxDistance: radiusVal * 1000 // Convert km to meters
        }
      }
    });

    const affectedCount = users.length;

    // Persist broadcast record in MongoDB
    const broadcast = await Broadcast.create({
      message,
      zone: { lat: latVal, lng: lngVal, radius: radiusVal },
      sentBy: req.user._id,
      affectedCount
    });

    // Broadcast Socket.IO event to all clients
    const io = req.app.get('io');
    if (io) {
      io.emit('authority_broadcast', {
        message,
        zone: { lat: latVal, lng: lngVal, radius: radiusVal },
        timestamp: new Date(),
        affected_users: affectedCount
      });
    }

    res.status(200).json({
      success: true,
      affected_users: affectedCount,
      broadcast
    });
  } catch (error) {
    console.error('Send broadcast error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while sending broadcast'
    });
  }
});

// ==============================================
// @route   GET /api/authority/broadcasts
// ==============================================
router.get('/broadcasts', async (req, res) => {
  try {
    const broadcasts = await Broadcast.find({})
      .populate('sentBy', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      broadcasts
    });
  } catch (error) {
    console.error('Get broadcasts error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching broadcast history'
    });
  }
});

// ==============================================
// @route   PUT /api/authority/alerts/:id/resolve
// ==============================================
router.put('/alerts/:id/resolve', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    alert.isActive = false;
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = req.user._id;
    await alert.save();

    // Emit live update socket
    const io = req.app.get('io');
    if (io) {
      io.emit('alert_resolved', { alertId: alert._id });
    }

    res.status(200).json({
      success: true,
      alert
    });
  } catch (error) {
    console.error('Resolve alert error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while resolving alert'
    });
  }
});

// ==============================================
// @route   GET /api/authority/grievances
// ==============================================
router.get('/grievances', async (req, res) => {
  try {
    // Find all alerts where grievances.length > 0
    const alerts = await Alert.find({ 'grievances.0': { $exists: true } })
      .populate('grievances.reportedBy', 'name email')
      .populate('reportedBy', 'name')
      .lean();

    // Sort by most grievances first
    alerts.sort((a, b) => (b.grievances?.length || 0) - (a.grievances?.length || 0));

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Get grievances error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching grievances'
    });
  }
});

module.exports = router;
