import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

function generateIcon(size, outputPath) {
	const canvas = createCanvas(size, size);
	const ctx = canvas.getContext('2d');

	// Background - primary purple
	ctx.fillStyle = '#2D1B4E';
	ctx.fillRect(0, 0, size, size);

	// Text "RB" in white
	ctx.fillStyle = '#FFFFFF';
	ctx.font = `bold ${size * 0.4}px sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('RB', size / 2, size / 2);

	// Save as PNG
	const buffer = canvas.toBuffer('image/png');
	writeFileSync(outputPath, buffer);
	console.log(`Generated: ${outputPath}`);
}

generateIcon(192, 'static/icons/icon-192.png');
generateIcon(512, 'static/icons/icon-512.png');
