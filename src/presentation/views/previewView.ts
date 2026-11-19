/** "Aperçu" tab: the exported page running in an isolated frame (scripts enabled, no access to the app). */
import type { PreviewGateway, Logger } from '../../application/ports';
import { h } from '../dom';

export class PreviewView {
  private readonly frame: HTMLIFrameElement;
  private readonly stage: HTMLElement;
  private readonly info: HTMLElement;
  private lastHtml = '';
  private pageHeight = 0;
  private width = 0;

  constructor(
    host: HTMLElement,
    private readonly gateway: PreviewGateway,
    private readonly log: Logger,
  ) {
    // Popups (links opened in a new tab) are handed to the system browser by the main process.
    this.frame = h('iframe', { class: 'preview-frame', sandbox: 'allow-scripts allow-forms allow-popups', title: 'Aperçu' });
    this.stage = h('div', { class: 'preview-stage' }, this.frame);
    this.info = h('span', { class: 'muted' });
    const reload = h('button', { class: 'btn', type: 'button' }, 'Recharger');
    reload.addEventListener('click', () => {
      const html = this.lastHtml;
      this.lastHtml = '';
      void this.show(html, this.width, this.frame.offsetHeight, this.stage.classList.contains('transparent'), this.pageHeight);
    });
    host.append(
      h('div', { class: 'view-bar' }, h('strong', {}, 'Aperçu interactif'), this.info, h('span', { class: 'spacer' }), reload),
      h('div', { class: 'preview-scroll' }, this.stage),
    );
  }

  /**
   * @param height screen (viewport) height: the frame size
   * @param pageHeight full page height (the frame scrolls when it is taller)
   */
  async show(html: string, width: number, height: number, transparent: boolean, pageHeight = height): Promise<void> {
    this.pageHeight = pageHeight;
    this.width = width;
    // Leave room for the vertical scrollbar of a scrolling page (no horizontal scrollbar).
    this.frame.style.width = `${width + (pageHeight > height ? 17 : 0)}px`;
    this.frame.style.height = `${height}px`;
    this.stage.classList.toggle('transparent', transparent);
    const scroll = pageHeight > height ? `, page de ${pageHeight} px : faites défiler` : '';
    this.info.textContent = `Écran ${width} × ${height} px${scroll} — scripts et liens actifs.`;
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    try {
      this.frame.src = await this.gateway.publish(html);
    } catch (err) {
      this.log.error('Preview update failed', err);
    }
  }
}
