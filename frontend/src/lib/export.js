import jsPDF from 'jspdf';
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
    doc.text(text, x, y, options.align ? { align: options.align } : undefined);
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
  const ballRollingPct = calcPercentage(session.ballRollingTime, session.totalDuration);

  // Metrics boxes
  const metricsData = [
    { label: 'Total Duration', value: formatTime(session.totalDuration) },
    { label: 'Total Events', value: session.events.length.toString() },
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
    doc.roundedRect(14, yPos, barWidth * (ballRollingPct / 100), barHeight, 2, 2, 'F');
  }
  
  yPos += barHeight + 5;
  addText(`Rolling: ${formatTime(session.ballRollingTime)}`, 14, yPos, { size: 9, color: '#F97316' });
  addText(`Stopped: ${formatTime(session.ballNotRollingTime)}`, pageWidth - 14, yPos, { size: 9, color: '#64748B', align: 'right' });
  yPos += 15;

  // Events by Type Table
  checkPageBreak(60);
  addText('Events by Type', 14, yPos, { size: 12, style: 'bold' });
  yPos += 8;

  const eventTableData = session.eventTypes.map(et => {
    const count = eventCounts[et.id] || 0;
    const pct = calcPercentage(count, session.events.length);
    return [et.name, count.toString(), `${pct}%`];
  });

  doc.autoTable({
    startY: yPos,
    head: [['Event Type', 'Count', 'Percentage']],
    body: eventTableData,
    theme: 'striped',
    headStyles: { fillColor: [250, 204, 21], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 }
  });
  yPos = doc.lastAutoTable.finalY + 15;

  // Descriptor Groups
  checkPageBreak(80);
  addText('Descriptors Analysis', 14, yPos, { size: 12, style: 'bold' });
  yPos += 8;

  // Calculate descriptor counts
  const desc1Counts = {};
  const desc2Counts = {};
  session.events.forEach(e => {
    e.descriptors1.forEach(d => { desc1Counts[d] = (desc1Counts[d] || 0) + 1; });
    e.descriptors2.forEach(d => { desc2Counts[d] = (desc2Counts[d] || 0) + 1; });
  });

  // Group 1
  addText(session.descriptorGroup1.name, 14, yPos, { size: 10, style: 'bold', color: '#0EA5E9' });
  yPos += 5;

  const desc1Data = session.descriptorGroup1.descriptors.map(d => [
    d.name,
    (desc1Counts[d.id] || 0).toString()
  ]);

  doc.autoTable({
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
  const group1EndY = doc.lastAutoTable.finalY;
  
  addText(session.descriptorGroup2.name, pageWidth / 2 + 5, yPos - 5, { size: 10, style: 'bold', color: '#22C55E' });

  const desc2Data = session.descriptorGroup2.descriptors.map(d => [
    d.name,
    (desc2Counts[d.id] || 0).toString()
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['Descriptor', 'Count']],
    body: desc2Data,
    theme: 'striped',
    headStyles: { fillColor: [74, 222, 128], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: pageWidth / 2 + 5, right: 14 },
    tableWidth: (pageWidth - 28) / 2 - 5
  });

  yPos = Math.max(group1EndY, doc.lastAutoTable.finalY) + 15;

  // Session Parts Summary
  checkPageBreak(60);
  addText('Session Parts Summary', 14, yPos, { size: 12, style: 'bold' });
  yPos += 8;

  const partsData = session.sessionParts.map(part => {
    const partEvents = session.events.filter(e => e.sessionPartId === part.id);
    const partTotal = part.ballRollingTime + part.ballNotRollingTime;
    const partBallPct = calcPercentage(part.ballRollingTime, partTotal);
    return [
      part.name,
      partEvents.length.toString(),
      formatTime(partTotal),
      `${partBallPct}%`
    ];
  });

  doc.autoTable({
    startY: yPos,
    head: [['Session Part', 'Events', 'Duration', 'Ball Rolling %']],
    body: partsData,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 }
  });
  yPos = doc.lastAutoTable.finalY + 15;

  // Event Timeline (condensed)
  if (session.events.length > 0) {
    checkPageBreak(80);
    addText('Event Timeline', 14, yPos, { size: 12, style: 'bold' });
    yPos += 8;

    const timelineData = session.events.slice(0, 20).map(event => {
      const part = session.sessionParts.find(p => p.id === event.sessionPartId);
      const desc1Names = event.descriptors1.map(d => 
        session.descriptorGroup1.descriptors.find(x => x.id === d)?.name || ''
      ).filter(Boolean).join(', ');
      const desc2Names = event.descriptors2.map(d => 
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

    doc.autoTable({
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
      yPos = doc.lastAutoTable.finalY + 5;
      addText(`... and ${session.events.length - 20} more events`, pageWidth / 2, yPos, { size: 8, color: '#64748B', align: 'center' });
    }
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
      event.descriptors1.includes(d.id) ? '1' : '0'
    );
    const desc2Values = session.descriptorGroup2.descriptors.map(d => 
      event.descriptors2.includes(d.id) ? '1' : '0'
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
  rows.push(['Ball Rolling Time (seconds)', session.ballRollingTime]);
  rows.push(['Ball Not Rolling Time (seconds)', session.ballNotRollingTime]);
  rows.push(['Ball Rolling %', calcPercentage(session.ballRollingTime, session.totalDuration)]);

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Create and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${session.name.replace(/[^a-z0-9]/gi, '_')}_data.csv`);
};

export default { exportToPDF, exportToCSV };
