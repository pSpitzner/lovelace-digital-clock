/* eslint-disable @typescript-eslint/no-explicit-any */
import {css, CSSResult, html, LitElement, PropertyValues, TemplateResult} from 'lit';
import {customElement, property, state} from 'lit/decorators';
import {DateTime} from 'luxon';
import {HomeAssistant} from 'custom-card-helpers';

import {CARD_VERSION} from './const';
import IRetroClockConfig from './IRetroClockConfig';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';

/* eslint no-console: 0 */
console.info(
    `%c  Retro-Clock \n%c  Version ${CARD_VERSION}    `,
    'color: orange; font-weight: bold; background: black',
    'color: white; font-weight: bold; background: dimgray',
);

// This puts your card into the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: 'retro-clock',
    name: 'RetroClock',
    description: 'A retrostyled clock component',
});

@customElement('retro-clock')
export class RetroClock extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _firstLine = '';
  @state() private _secondLine = '';
  @state() private _config?: IRetroClockConfig;
  @state() private _interval = 1000;
  private _intervalId?: number;

  public setConfig(config: IRetroClockConfig): void {
    this._config = { ...config };
    if (this._config.timeFormat) this._config.firstLineFormat = this._config.timeFormat;
    if (this._config.dateFormat) this._config.secondLineFormat = this._config.dateFormat;
    if (this._config.interval !== this._interval) this._interval = this._config.interval ?? 1000;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    return (
      changedProps.has('_firstLine') ||
      changedProps.has('_secondLine') ||
      changedProps.has('_config') ||
      changedProps.has('hass')
    );
  }

  public async getCardSize(): Promise<number> {
    return 3;
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('_interval')) {
      this._stopInterval();
      this._startInterval();
    }
    if (changedProperties.has('_config')) this._updateDateTime();
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._startInterval();
  }

  private _startInterval(): void {
    if (this._intervalId) return;

    this._intervalId = window.setInterval(this._updateDateTime.bind(this), this._interval);
  }

  private _stopInterval(): void {
    if (!this._intervalId) return;
    window.clearInterval(this._intervalId);
    this._intervalId = undefined;
  }




  private _timeToRgb(): number[] {
    const now = DateTime.local();
    const currentTime = now.hour * 3600 + now.minute * 60 + now.second;

    function hexToRgb(hex: string): number[] {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
    }

    // Define your key times and their colors here.
    // Times are in seconds since midnight.
    const keyTimes = [
      { time: 0 * 3600, color: hexToRgb('#F18C8E') },
      { time: 4 * 3600, color: hexToRgb('#F0B7A4') },
      { time: 7 * 3600, color: hexToRgb('#F1D1B5') },
      { time: 12 * 3600, color: hexToRgb('#FFF') },
      { time: 18 * 3600, color: hexToRgb('#8CB4C5') },
      { time: 20 * 3600, color: hexToRgb('#548EA7') },
      { time: 22 * 3600, color: hexToRgb('#998BA8') },
    ];

    // Find the two key times that the current time falls between.
    let i = 0;
    while (currentTime >= keyTimes[i + 1].time) {
      i++;
    }

    // Interpolate between the colors of the two key times.
    const t = (currentTime - keyTimes[i].time) / (keyTimes[i + 1].time - keyTimes[i].time);
    const color = keyTimes[i].color.map((start, j) => Math.floor(start + t * (keyTimes[i + 1].color[j] - start)));

    return [color[0], color[1], color[2]];
  }

  private _formatTime(dateString: string, blinkDividers = false): string {

    let timeDiv = dateString;
    let placeholder = dateString.replace(/\d/g, '8').replace(/[a-zA-Z]/g, 'B');
    // we want the separator in the less wide font, thus give it a class
    if (blinkDividers) timeDiv = timeDiv.replace(/:/g, '<span class="blink separator">:</span>');
    else timeDiv = timeDiv.replace(/:/g, '<span class="separator">:</span>');
    placeholder = placeholder.replace(/:/g, '<span class="separator">:</span>');

    timeDiv = `<div class="foreground">${timeDiv}</div>`;
    placeholder = `<div class="placeholder">${placeholder}</div>`;

    return `${timeDiv}${placeholder}`;
  }

  private async _updateDateTime(): Promise<void> {
    const timeZone = this._config?.timeZone ?? this.hass?.config?.time_zone;
    const locale = this._config?.locale ?? this.hass?.locale?.language;

    let dateTime: DateTime = DateTime.local();
    /* if (!this._config?.useHATime) {
            dateTime = DateTime.local();
        } else {
            dateTime = DateTime.fromSeconds(await new Promise<number>((resolve) => {
                this.hass.connection.subscribeMessage(
                    (msg) => resolve(parseInt((msg as any).result, 10)),
                    {type: "render_template", template: '{{as_timestamp(now())}}'}
                );
            }));
        } */

    if (timeZone) dateTime = dateTime.setZone(timeZone);
    if (locale) dateTime = dateTime.setLocale(locale);

    let firstLine: string;
    let secondLine: string;

    if (typeof this._config?.firstLineFormat === 'string') firstLine = dateTime.toFormat(this._config.firstLineFormat);
    else firstLine = dateTime.toLocaleString(this._config?.firstLineFormat ?? { hour: '2-digit', minute: '2-digit' });

    if (typeof this._config?.secondLineFormat === 'string')
      secondLine = dateTime.toFormat(this._config.secondLineFormat);
    else
      secondLine = dateTime.toLocaleString(
        this._config?.secondLineFormat ?? { weekday: 'short', day: '2-digit', month: 'short' },
      );

    firstLine = this._formatTime(firstLine, this._config?.blinkDividers);
    secondLine = this._formatTime(secondLine);

    if (firstLine !== this._firstLine) this._firstLine = firstLine;
    if (secondLine !== this._secondLine) this._secondLine = secondLine;
  }

  public disconnectedCallback(): void {
    this._stopInterval();
    super.disconnectedCallback();
  }

  protected render(): TemplateResult | void {
    const color = this._timeToRgb();
    return html`
      <ha-card style="--text-color: rgb(${color}); --glow-color: rgba(${color}, 0.4);">
        <div class="line first-line">
          ${unsafeHTML(this._firstLine)}
        </div>
        <div class="line second-line">
          ${unsafeHTML(this._secondLine)}
        </div>
      </ha-card>
    `;
  }

  static get styles(): CSSResult {
    // we should probably integrate the fonts somehow:
    // https://community.home-assistant.io/t/use-ttf-in-lovelace/143495/33
    return css`
      ha-card {
        padding-right: 8px;
        text-align: right;
        font-family: 'digital-7 (mono)', sans-serif;
      }

      .line {
        position: relative;
      }

      .line .foreground {
        display: inline-block;
        position: relative;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        color: var(--text-color);
        text-shadow: 0 0 5px var(--glow-color), 0 0 10px var(--glow-color), 0 0 15px var(--glow-color),
          0 0 20px var(--glow-color);
      }

      .line .placeholder {
        display: inline-block;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 50;
        opacity: 0.15;
        color: var(--text-color);
      }

      .line .separator {
        font-family: 'digital-7', sans-serif;
      }

      .first-line {
        font-size: 2em;
        line-height: 1em;
      }

      .second-line {
        font-size: 1em;
        line-height: 1em;
      }

      @keyframes blink {
        0%,
        49% {
          opacity: 1;
        }
        50%,
        100% {
          opacity: 0;
        }
      }

      .blink {
        animation: blink 2s steps(1) infinite;
      }
    `;
  }
}
