import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { formatTime, formatDateTime, calcPercentage, countBy } from './utils';

// Export session to PDF with visualizations
export const exportToPDF = async (session) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Helper to add text
  const addText = (text, x, y, options = {}) => {
    doc.setFontSize(options.size || 12);
    doc.setFont('helvetica', options.style || 'normal');
    doc.setTextColor(options.color || '#0F172A');
    doc.text(String(text), x, y, options.align ? { align: options.align } : undefined);
  };

  // Helper to check page break
  const checkPageBreak = (neededSpace) => {
    if (yPos + neededSpace > 280) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Title
  addText('My Coach Developer', pageWidth / 2, yPos, { size: 24, style: 'bold', align: 'center' });
  yPos += 8;
  addText('Observation Report', pageWidth / 2, yPos, { size: 14, color: '#64748B', align: 'center' });
  yPos += 15;

  // Session Info
  doc.setDrawColor('#E2E8F0');
  doc.setFillColor('#F8FAFC');
  doc.roundedRect(14, yPos, pageWidth - 28, 30, 3, 3, 'FD');
  yPos += 10;
  
  addText(session.name, 20, yPos, { size: 16, style: 'bold' });
  yPos += 7;
  addText(`Date: ${formatDateTime(session.createdAt)}`, 20, yPos, { size: 10, color: '#64748B' });
  addText(`Duration: ${formatTime(session.totalDuration)}`, pageWidth - 20, yPos, { size: 10, color: '#64748B', align: 'right' });
  yPos += 20;

  // Key Metrics
  checkPageBreak(50);
  addText('Session Overview', 14, yPos, { size: 14, style: 'bold' });
  yPos += 10;

  // Calculate stats
  const eventCounts = countBy(session.events, 'eventTypeId');
  const totalTime = session.ballRollingTime + session.ballNotRollingTime;
  const ballRollingPct = calcPercentage(session.ballRollingTime, totalTime || session.totalDuration);

  // Metrics boxes
  const metricsData = [
    { label: 'Total Duration', value: formatTime(session.totalDuration) },
    { label: 'Total Events', value: String(session.events.length) },
    { label: 'Ball Rolling', value: `${ballRollingPct}%` },
    { label: 'Ball Stopped', value: `${100 - ballRollingPct}%` }
  ];

  const boxWidth = (pageWidth - 28 - 15) / 4;
  metricsData.forEach((metric, i) => {
    const x = 14 + (boxWidth + 5) * i;
    doc.setFillColor('#F1F5F9');
    doc.roundedRect(x, yPos, boxWidth, 25, 2, 2, 'F');
    addText(metric.value, x + boxWidth / 2, yPos + 10, { size: 14, style: 'bold', align: 'center' });
    addText(metric.label, x + boxWidth / 2, yPos + 18, { size: 8, color: '#64748B', align: 'center' });
  });
  yPos += 35;

  // Ball Rolling Bar
  checkPageBreak(30);
  addText('Ball Rolling Time Distribution', 14, yPos, { size: 12, style: 'bold' });
  yPos += 8;

  const barWidth = pageWidth - 28;
  const barHeight = 12;
  
  // Background bar
  doc.setFillColor('#E2E8F0');
  doc.roundedRect(14, yPos, barWidth, barHeight, 2, 2, 'F');
  
  // Ball rolling portion
  if (ballRollingPct > 0) {
    doc.setFillColor('#F97316');
    const rollingWidth = Math.max(1, barWidth * (ballRollingPct / 100));
    doc.roundedRect(14, yPos, rollingWidth, barHeight, 2, 2, 'F');
  }
  
  yPos += barHeight + 5;
  addText(`Rolling: ${formatTime(session.ballRollingTime || 0)}`, 14, yPos, { size: 9, color: '#F97316' });
  addText(`Stopped: ${formatTime(session.ballNotRollingTime || 0)}`, pageWidth - 14, yPos, { size: 9, color: '#64748B', align: 'right' });
  yPos += 15;

  // Events by Type Table
  checkPageBreak(60);
  addText('Events by Type', 14, yPos, { size: 12, style: 'bold' });
  yPos += 8;

  const eventTableData = session.eventTypes.map(et => {
    const count = eventCounts[et.id] || 0;
    const pct = calcPercentage(count, session.events.length);
    return [et.name, String(count), `${pct}%`];
  });

  const eventTable = autoTable(doc, {
    startY: yPos,
    head: [['Event Type', 'Count', 'Percentage']],
    body: eventTableData,
    theme: 'striped',
    headStyles: { fillColor: [250, 204, 21], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 }
  });
  yPos = (doc.lastAutoTable?.finalY || yPos + 40) + 15;

  // Descriptor Groups
  checkPageBreak(80);
  addText('Descriptors Analysis', 14, yPos, { size: 12, style: 'bold' });
  yPos += 8;

  // Calculate descriptor counts
  const desc1Counts = {};
  const desc2Counts = {};
  session.events.forEach(e => {
    (e.descriptors1 || []).forEach(d => { desc1Counts[d] = (desc1Counts[d] || 0) + 1; });
    (e.descriptors2 || []).forEach(d => { desc2Counts[d] = (desc2Counts[d] || 0) + 1; });
  });

  // Group 1
  addText(session.descriptorGroup1.name, 14, yPos, { size: 10, style: 'bold', color: '#0EA5E9' });
  yPos += 5;

  const desc1Data = session.descriptorGroup1.descriptors.map(d => [
    d.name,
    String(desc1Counts[d.id] || 0)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Descriptor', 'Count']],
    body: desc1Data,
    theme: 'striped',
    headStyles: { fillColor: [56, 189, 248], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: 14, right: pageWidth / 2 + 5 },
    tableWidth: (pageWidth - 28) / 2 - 5
  });

  // Group 2 (side by side)
  const group1EndY = doc.lastAutoTable?.finalY || yPos + 30;
  
  addText(session.descriptorGroup2.name, pageWidth / 2 + 5, yPos - 5, { size: 10, style: 'bold', color: '#22C55E' });

  const desc2Data = session.descriptorGroup2.descriptors.map(d => [
    d.name,
    String(desc2Counts[d.id] || 0)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Descriptor', 'Count']],
    body: desc2Data,
    theme: 'striped',
    headStyles: { fillColor: [74, 222, 128], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: pageWidth / 2 + 5, right: 14 },
    tableWidth: (pageWidth - 28) / 2 - 5
  });

  yPos = Math.max(group1EndY, doc.lastAutoTable?.finalY || yPos + 30) + 15;

  // Session Parts Summary
  checkPageBreak(60);
  addText('Session Parts Summary', 14, yPos, { size: 12, style: 'bold' });
  yPos += 8;

  const partsData = session.sessionParts.map(part => {
    const partEvents = session.events.filter(e => e.sessionPartId === part.id);
    const partTotal = (part.ballRollingTime || 0) + (part.ballNotRollingTime || 0);
    const partBallPct = calcPercentage(part.ballRollingTime || 0, partTotal);
    return [
      part.name,
      String(partEvents.length),
      formatTime(partTotal),
      `${partBallPct}%`
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Session Part', 'Events', 'Duration', 'Ball Rolling %']],
    body: partsData,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 }
  });
  yPos = (doc.lastAutoTable?.finalY || yPos + 40) + 15;

  // Event Timeline (condensed)
  if (session.events.length > 0) {
    checkPageBreak(80);
    addText('Event Timeline', 14, yPos, { size: 12, style: 'bold' });
    yPos += 8;

    const timelineData = session.events.slice(0, 20).map(event => {
      const part = session.sessionParts.find(p => p.id === event.sessionPartId);
      const desc1Names = (event.descriptors1 || []).map(d => 
        session.descriptorGroup1.descriptors.find(x => x.id === d)?.name || ''
      ).filter(Boolean).join(', ');
      const desc2Names = (event.descriptors2 || []).map(d => 
        session.descriptorGroup2.descriptors.find(x => x.id === d)?.name || ''
      ).filter(Boolean).join(', ');
      
      return [
        new Date(event.timestamp).toLocaleTimeString(),
        event.eventTypeName,
        part?.name || '',
        event.ballRolling ? 'Rolling' : 'Stopped',
        desc1Names || '-',
        desc2Names || '-'
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Time', 'Event', 'Part', 'Ball', session.descriptorGroup1.name, session.descriptorGroup2.name]],
      body: timelineData,
      theme: 'striped',
      headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 18 },
        4: { cellWidth: 35 },
        5: { cellWidth: 35 }
      },
      margin: { left: 14, right: 14 }
    });

    if (session.events.length > 20) {
      yPos = (doc.lastAutoTable?.finalY || yPos + 40) + 5;
      addText(`... and ${session.events.length - 20} more events`, pageWidth / 2, yPos, { size: 8, color: '#64748B', align: 'center' });
    }
  }

  // AI Summary if present
  if (session.aiSummary) {
    doc.addPage();
    yPos = 20;
    addText('AI Session Summary', 14, yPos, { size: 14, style: 'bold' });
    yPos += 10;
    
    // Split and wrap text
    const lines = doc.splitTextToSize(session.aiSummary, pageWidth - 28);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(lines, 14, yPos);
  }

  // Observer Notes if present
  if (session.sessionNotes) {
    if (!session.aiSummary) {
      doc.addPage();
      yPos = 20;
    } else {
      yPos = doc.lastAutoTable?.finalY || yPos + 60;
      checkPageBreak(40);
    }
    
    addText('Observer Notes', 14, yPos, { size: 14, style: 'bold' });
    yPos += 10;
    
    const noteLines = doc.splitTextToSize(session.sessionNotes, pageWidth - 28);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(noteLines, 14, yPos);
  }

  // Footer on each page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor('#94A3B8');
    doc.text(
      `Generated by My Coach Developer • Page ${i} of ${pageCount}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  // Save
  doc.save(`${session.name.replace(/[^a-z0-9]/gi, '_')}_report.pdf`);
};

// Export session to CSV
export const exportToCSV = (session) => {
  const headers = [
    'Timestamp',
    'Event Type',
    'Session Part',
    'Ball Rolling',
    ...session.descriptorGroup1.descriptors.map(d => `${session.descriptorGroup1.name}: ${d.name}`),
    ...session.descriptorGroup2.descriptors.map(d => `${session.descriptorGroup2.name}: ${d.name}`),
    'Note'
  ];

  const rows = session.events.map(event => {
    const part = session.sessionParts.find(p => p.id === event.sessionPartId);
    
    const desc1Values = session.descriptorGroup1.descriptors.map(d => 
      (event.descriptors1 || []).includes(d.id) ? '1' : '0'
    );
    const desc2Values = session.descriptorGroup2.descriptors.map(d => 
      (event.descriptors2 || []).includes(d.id) ? '1' : '0'
    );

    return [
      new Date(event.timestamp).toISOString(),
      event.eventTypeName,
      part?.name || '',
      event.ballRolling ? 'Rolling' : 'Stopped',
      ...desc1Values,
      ...desc2Values,
      event.note || ''
    ];
  });

  // Add summary rows
  rows.push([]);
  rows.push(['--- SESSION SUMMARY ---']);
  rows.push(['Session Name', session.name]);
  rows.push(['Date', formatDateTime(session.createdAt)]);
  rows.push(['Total Duration (seconds)', session.totalDuration]);
  rows.push(['Total Events', session.events.length]);
  rows.push(['Ball Rolling Time (seconds)', Math.round(session.ballRollingTime || 0)]);
  rows.push(['Ball Not Rolling Time (seconds)', Math.round(session.ballNotRollingTime || 0)]);
  rows.push(['Ball Rolling %', calcPercentage(session.ballRollingTime || 0, session.totalDuration)]);

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Create and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${session.name.replace(/[^a-z0-9]/gi, '_')}_data.csv`);
};

// Export coach report for a time period to PDF
export const exportCoachReportPDF = async (coach, sessions, startDate, endDate) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Helper to add text
  const addText = (text, x, y, options = {}) => {
    doc.setFontSize(options.size || 12);
    doc.setFont('helvetica', options.style || 'normal');
    doc.setTextColor(options.color || '#0F172A');
    doc.text(String(text), x, y, options.align ? { align: options.align } : undefined);
  };

  // Helper to check page break
  const checkPageBreak = (neededSpace) => {
    if (yPos + neededSpace > 280) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Title
  addText('My Coach Developer', pageWidth / 2, yPos, { size: 24, style: 'bold', align: 'center' });
  yPos += 8;
  addText('Coach Development Report', pageWidth / 2, yPos, { size: 14, color: '#64748B', align: 'center' });
  yPos += 15;

  // Coach Info Box
  doc.setDrawColor('#E2E8F0');
  doc.setFillColor('#F8FAFC');
  doc.roundedRect(14, yPos, pageWidth - 28, 35, 3, 3, 'FD');
  yPos += 10;
  
  addText(coach.name, 20, yPos, { size: 18, style: 'bold' });
  yPos += 7;
  if (coach.role) {
    addText(`Role: ${coach.role}`, 20, yPos, { size: 10, color: '#64748B' });
    yPos += 5;
  }
  addText(`Report Period: ${formatDateTime(startDate)} - ${formatDateTime(endDate)}`, 20, yPos, { size: 10, color: '#64748B' });
  yPos += 20;

  // Summary Stats
  checkPageBreak(50);
  addText('Summary Statistics', 14, yPos, { size: 14, style: 'bold' });
  yPos += 10;

  // Calculate aggregate stats
  const totalSessions = sessions.length;
  const totalEvents = sessions.reduce((sum, s) => sum + (s.events?.length || 0), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
  const totalBallRolling = sessions.reduce((sum, s) => sum + (s.ballRollingTime || 0), 0);
  const totalBallStopped = sessions.reduce((sum, s) => sum + (s.ballNotRollingTime || 0), 0);
  const avgBallRolling = calcPercentage(totalBallRolling, totalBallRolling + totalBallStopped);

  const metricsData = [
    { label: 'Sessions', value: String(totalSessions) },
    { label: 'Total Events', value: String(totalEvents) },
    { label: 'Total Time', value: formatTime(totalDuration) },
    { label: 'Avg Ball Rolling', value: `${avgBallRolling}%` }
  ];

  const boxWidth = (pageWidth - 28 - 15) / 4;
  metricsData.forEach((metric, i) => {
    const x = 14 + (boxWidth + 5) * i;
    doc.setFillColor('#F1F5F9');
    doc.roundedRect(x, yPos, boxWidth, 25, 2, 2, 'F');
    addText(metric.value, x + boxWidth / 2, yPos + 10, { size: 14, style: 'bold', align: 'center' });
    addText(metric.label, x + boxWidth / 2, yPos + 18, { size: 8, color: '#64748B', align: 'center' });
  });
  yPos += 35;

  // Intervention Type Analysis (aggregate across all sessions)
  checkPageBreak(80);
  addText('Intervention Analysis (Aggregate)', 14, yPos, { size: 14, style: 'bold' });
  yPos += 10;

  // Aggregate event counts across all sessions
  const aggregateEventCounts = {};
  const interventionTypeNames = {};
  sessions.forEach(session => {
    (session.eventTypes || []).forEach(et => {
      interventionTypeNames[et.id] = et.name;
    });
    (session.events || []).forEach(event => {
      const typeId = event.eventTypeId;
      aggregateEventCounts[typeId] = (aggregateEventCounts[typeId] || 0) + 1;
    });
  });

  const eventTableData = Object.entries(aggregateEventCounts).map(([typeId, count]) => {
    const pct = calcPercentage(count, totalEvents);
    return [interventionTypeNames[typeId] || typeId, String(count), `${pct}%`];
  });

  if (eventTableData.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Intervention Type', 'Total Count', 'Percentage']],
      body: eventTableData,
      theme: 'striped',
      headStyles: { fillColor: [250, 204, 21], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 10 },
      margin: { left: 14, right: 14 }
    });
    yPos = (doc.lastAutoTable?.finalY || yPos + 40) + 15;
  }

  // Session-by-Session Summary
  checkPageBreak(80);
  addText('Session Summary', 14, yPos, { size: 14, style: 'bold' });
  yPos += 10;

  const sessionTableData = sessions.map(s => {
    const ballTotal = (s.ballRollingTime || 0) + (s.ballNotRollingTime || 0);
    const ballPct = calcPercentage(s.ballRollingTime || 0, ballTotal || s.totalDuration);
    return [
      s.name,
      formatDateTime(s.createdAt),
      formatTime(s.totalDuration),
      String(s.events?.length || 0),
      `${ballPct}%`
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Session', 'Date', 'Duration', 'Events', 'Ball Rolling %']],
    body: sessionTableData,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20 },
      4: { cellWidth: 25 }
    }
  });
  yPos = (doc.lastAutoTable?.finalY || yPos + 40) + 15;

  // Development Targets Progress
  const targets = coach.targets || [];
  if (targets.length > 0) {
    checkPageBreak(60);
    addText('Development Targets', 14, yPos, { size: 14, style: 'bold' });
    yPos += 10;

    const activeTargets = targets.filter(t => t.status === 'active');
    const achievedTargets = targets.filter(t => t.status === 'achieved');

    const targetTableData = targets.map(t => [
      t.text,
      t.status === 'achieved' ? 'Achieved' : 'Active',
      formatDateTime(t.createdAt)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Target', 'Status', 'Created']],
      body: targetTableData,
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    yPos = (doc.lastAutoTable?.finalY || yPos + 40) + 15;

    // Target progress bar
    checkPageBreak(30);
    addText(`Progress: ${achievedTargets.length} of ${targets.length} targets achieved`, 14, yPos, { size: 10 });
    yPos += 8;
    
    const progressBarWidth = pageWidth - 28;
    doc.setFillColor('#E2E8F0');
    doc.roundedRect(14, yPos, progressBarWidth, 8, 2, 2, 'F');
    
    const progressPct = targets.length > 0 ? (achievedTargets.length / targets.length) : 0;
    if (progressPct > 0) {
      doc.setFillColor('#22C55E');
      doc.roundedRect(14, yPos, progressBarWidth * progressPct, 8, 2, 2, 'F');
    }
    yPos += 20;
  }

  // AI Trend Summary if available
  if (coach.aiTrendSummary) {
    checkPageBreak(80);
    addText('AI Development Analysis', 14, yPos, { size: 14, style: 'bold' });
    yPos += 10;
    
    doc.setFillColor('#F3E8FF');
    doc.roundedRect(14, yPos, pageWidth - 28, 60, 3, 3, 'F');
    yPos += 8;
    
    const lines = doc.splitTextToSize(coach.aiTrendSummary, pageWidth - 36);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#581C87');
    doc.text(lines.slice(0, 10), 20, yPos);
    
    if (lines.length > 10) {
      yPos += 50;
      addText('...continued in full AI analysis', 14, yPos, { size: 8, color: '#64748B' });
    }
  }

  // Footer on each page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor('#94A3B8');
    doc.text(
      `Generated by My Coach Developer • ${coach.name} • Page ${i} of ${pageCount}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  // Save
  const fileName = `${coach.name.replace(/[^a-z0-9]/gi, '_')}_report_${startDate}_to_${endDate}.pdf`;
  doc.save(fileName);
};

// Export coach report for a time period to CSV
export const exportCoachReportCSV = (coach, sessions, startDate, endDate) => {
  const rows = [];
  
  // Header section
  rows.push(['COACH DEVELOPMENT REPORT']);
  rows.push(['Coach Name', coach.name]);
  rows.push(['Role', coach.role || 'N/A']);
  rows.push(['Report Period', `${startDate} to ${endDate}`]);
  rows.push(['Generated', new Date().toISOString()]);
  rows.push([]);
  
  // Summary stats
  rows.push(['--- SUMMARY STATISTICS ---']);
  const totalSessions = sessions.length;
  const totalEvents = sessions.reduce((sum, s) => sum + (s.events?.length || 0), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
  const totalBallRolling = sessions.reduce((sum, s) => sum + (s.ballRollingTime || 0), 0);
  const totalBallStopped = sessions.reduce((sum, s) => sum + (s.ballNotRollingTime || 0), 0);
  
  rows.push(['Total Sessions', totalSessions]);
  rows.push(['Total Events', totalEvents]);
  rows.push(['Total Duration (seconds)', Math.round(totalDuration)]);
  rows.push(['Total Ball Rolling (seconds)', Math.round(totalBallRolling)]);
  rows.push(['Total Ball Stopped (seconds)', Math.round(totalBallStopped)]);
  rows.push(['Avg Ball Rolling %', calcPercentage(totalBallRolling, totalBallRolling + totalBallStopped)]);
  rows.push([]);
  
  // Intervention analysis
  rows.push(['--- INTERVENTION ANALYSIS ---']);
  const aggregateEventCounts = {};
  const interventionTypeNames = {};
  sessions.forEach(session => {
    (session.eventTypes || []).forEach(et => {
      interventionTypeNames[et.id] = et.name;
    });
    (session.events || []).forEach(event => {
      const typeId = event.eventTypeId;
      aggregateEventCounts[typeId] = (aggregateEventCounts[typeId] || 0) + 1;
    });
  });
  
  rows.push(['Intervention Type', 'Count', 'Percentage']);
  Object.entries(aggregateEventCounts).forEach(([typeId, count]) => {
    const pct = calcPercentage(count, totalEvents);
    rows.push([interventionTypeNames[typeId] || typeId, count, `${pct}%`]);
  });
  rows.push([]);
  
  // Session details
  rows.push(['--- SESSION DETAILS ---']);
  rows.push(['Session Name', 'Date', 'Duration', 'Events', 'Ball Rolling %', 'Context']);
  sessions.forEach(s => {
    const ballTotal = (s.ballRollingTime || 0) + (s.ballNotRollingTime || 0);
    const ballPct = calcPercentage(s.ballRollingTime || 0, ballTotal || s.totalDuration);
    rows.push([
      s.name,
      formatDateTime(s.createdAt),
      formatTime(s.totalDuration),
      s.events?.length || 0,
      `${ballPct}%`,
      s.observationContext || 'training'
    ]);
  });
  rows.push([]);
  
  // Targets
  const targets = coach.targets || [];
  if (targets.length > 0) {
    rows.push(['--- DEVELOPMENT TARGETS ---']);
    rows.push(['Target', 'Status', 'Created']);
    targets.forEach(t => {
      rows.push([t.text, t.status, formatDateTime(t.createdAt)]);
    });
    rows.push([]);
  }
  
  // AI Summary
  if (coach.aiTrendSummary) {
    rows.push(['--- AI TREND ANALYSIS ---']);
    rows.push([coach.aiTrendSummary]);
  }
  
  // Convert to CSV
  const csvContent = rows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const fileName = `${coach.name.replace(/[^a-z0-9]/gi, '_')}_report_${startDate}_to_${endDate}.csv`;
  saveAs(blob, fileName);
};

export default { exportToPDF, exportToCSV, exportCoachReportPDF, exportCoachReportCSV };
