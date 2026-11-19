/** "Aperçu" tab: the exported page running in an isolated frame (scripts enabled, no access to the app). */
import type { PreviewGateway, Logger } from '../../application/ports';
import { h } from '../dom';

export class PreviewView {
  private readonly frame: HTMLIFrameElement;
  private readonly stage: HTMLElement;
  private readonly info: HTMLElement;
  private lastHtml = '';

  constructor(
    host: HTMLElement,
    private readonly gateway: PreviewGateway,
    private readonly log: Logger,
  ) {
    this.frame = h('iframe', { class: 'preview-frame', sandbox: 'allow-scripts allow-forms', title: 'Aperçu' });
    this.stage = h('div', { class: 'preview-stage' }, this.frame);
    this.info = h('span', { class: 'muted' });
    const reload = h('button', { class: 'btn', type: 'button' }, 'Recharger');
    reload.addEventListener('click', () => {
      const html = this.lastHtml;
      this.lastHtml = '';
      void this.show(html, this.frame.offsetWidth, this.frame.offsetHeight, this.stage.classList.contains('transparent'));
    });
    host.append(
      h('div', { class: 'view-bar' }, h('strong', {}, 'Aperçu interactif'), this.info, h('span', { class: 'spacer' }), reload),
      h('div', { class: 'preview-scroll' }, this.stage),
    );
  }

  async show(html: string, width: number, height: number, transparent: boolean): Promise<void> {
    this.frame.style.width = `${width}px`;
    this.frame.style.height = `${height}px`;
    this.stage.classList.toggle('transparent', transparent);
    this.info.textContent = `${width} × ${height} px — les scripts « au clic » sont actifs ici.`;
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    try {
      this.frame.src = await this.gateway.publish(html);
    } catch (err) {
      this.log.error('Preview update failed', err);
    }
  }
}
