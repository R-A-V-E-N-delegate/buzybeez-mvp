import { test, expect } from '@playwright/test';

test.describe('BuzyBeez UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForSelector('h1:has-text("BuzyBeez")');
  });

  test('Page loads with header', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('BuzyBeez');
  });

  test('Shows connection status', async ({ page }) => {
    // Should show Live or Offline
    const statusText = page.locator('text=Live').or(page.locator('text=Offline'));
    await expect(statusText).toBeVisible();
  });

  test('Has Add Bee button', async ({ page }) => {
    const addButton = page.locator('button:has-text("New Bee")');
    await expect(addButton).toBeVisible();
  });

  test('Canvas displays nodes', async ({ page }) => {
    // Wait for nodes to load
    await page.waitForTimeout(1000);

    // Should have at least the human node
    const humanNode = page.locator('text=Human Mailbox');
    await expect(humanNode).toBeVisible();
  });

  test('Clicking Add Bee opens modal', async ({ page }) => {
    const addButton = page.locator('button:has-text("New Bee")');
    await addButton.click();

    // Modal should appear with heading
    await expect(page.locator('h3:has-text("Add New Bee")')).toBeVisible();

    // Modal should have form elements
    await expect(page.locator('label:has-text("Bee Name")')).toBeVisible();
  });

  test('Can close Add Bee modal', async ({ page }) => {
    const addButton = page.locator('button:has-text("New Bee")');
    await addButton.click();

    // Wait for modal to appear
    await expect(page.locator('h3:has-text("Add New Bee")')).toBeVisible();

    // Click cancel button
    const closeButton = page.locator('button:has-text("Cancel")');
    await closeButton.click();

    // Modal should be hidden
    await expect(page.locator('h3:has-text("Add New Bee")')).not.toBeVisible();
  });

  test.describe('Node Interactions', () => {
    test('Clicking human node opens compose modal', async ({ page }) => {
      // Wait for nodes to load
      await page.waitForTimeout(1000);

      // Click on human node
      const humanNode = page.locator('text=Human Mailbox').first();
      await humanNode.click();

      // Compose modal should appear (use heading selector to be specific)
      await expect(page.locator('h3:has-text("Compose Mail")')).toBeVisible({ timeout: 5000 });
    });

    test('Clicking bee node opens side panel', async ({ page }) => {
      // Wait for nodes to load
      await page.waitForTimeout(1000);

      // Find a bee node
      const beeNode = page.locator('.react-flow__node-bee').first();

      if (await beeNode.count() > 0) {
        await beeNode.click();

        // Side panel should appear - look for the panel container with bee name and controls
        // The side panel has Inbox/Outbox tabs which are unique to it
        await expect(page.locator('button:has-text("Inbox")')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('button:has-text("Outbox")')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Canvas Interactions', () => {
    test('Canvas has zoom controls', async ({ page }) => {
      const controls = page.locator('.react-flow__controls');
      await expect(controls).toBeVisible();
    });

    test('Canvas has minimap', async ({ page }) => {
      const minimap = page.locator('.react-flow__minimap');
      await expect(minimap).toBeVisible();
    });

    test('Nodes are draggable', async ({ page }) => {
      // Wait for nodes to load
      await page.waitForTimeout(1000);

      const node = page.locator('.react-flow__node').first();
      const box = await node.boundingBox();

      if (box) {
        // Drag the node
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 100, box.y + 100);
        await page.mouse.up();

        // Node should have moved (position changed)
        const newBox = await node.boundingBox();
        expect(newBox?.x).not.toBe(box.x);
      }
    });
  });
});
