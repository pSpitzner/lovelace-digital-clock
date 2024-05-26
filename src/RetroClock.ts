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
    @property({attribute: false}) public hass!: HomeAssistant;
    @state() private _firstLine = '';
    @state() private _secondLine = '';
    @state() private _config?: IRetroClockConfig;
    @state() private _interval = 1000;
    private _intervalId?: number;

    public setConfig(config: IRetroClockConfig): void {
        this._config = {...config};
        if (this._config.timeFormat)
            this._config.firstLineFormat = this._config.timeFormat;
        if (this._config.dateFormat)
            this._config.secondLineFormat = this._config.dateFormat;
        if (this._config.interval !== this._interval)
            this._interval = this._config.interval ?? 1000;
    }

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        return changedProps.has('_firstLine') || changedProps.has('_secondLine') || changedProps.has('_config') || changedProps.has('hass');
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
        if (changedProperties.has('_config'))
            this._updateDateTime();
    }

    public connectedCallback(): void {
        super.connectedCallback();
        this._startInterval();
    }

    private _startInterval(): void {
        if (this._intervalId)
            return;

        this._intervalId = window.setInterval(this._updateDateTime.bind(this), this._interval);
    }

    private _stopInterval(): void {
        if (!this._intervalId)
            return;
        window.clearInterval(this._intervalId);
        this._intervalId = undefined;
    }

    private _formatTime(dateString: string, blinkDividers=false): string {
        const placeholder = dateString.replace(/\d/g, '8').replace(/[a-zA-Z]/g, 'B');
        const placeholderDiv = `<div class="placeholder">${placeholder}</div>`;
        let timeDiv = `<div class="foreground">${dateString}</div>`;

        if (blinkDividers)
            timeDiv = timeDiv.replace(/:/g, '<span class="blink">:</span>');

        return `${timeDiv}${placeholderDiv}`;
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

        if (timeZone)
            dateTime = dateTime.setZone(timeZone);
        if (locale)
            dateTime = dateTime.setLocale(locale);

        let firstLine: string;
        let secondLine: string;

        if (typeof this._config?.firstLineFormat === 'string')
            firstLine = dateTime.toFormat(this._config.firstLineFormat);
        else
            firstLine = dateTime.toLocaleString(this._config?.firstLineFormat ?? {hour: '2-digit', minute: '2-digit'});

        if (typeof this._config?.secondLineFormat === 'string')
            secondLine = dateTime.toFormat(this._config.secondLineFormat);
        else
            secondLine = dateTime.toLocaleString(this._config?.secondLineFormat ?? {weekday: 'short', day: '2-digit', month: 'short'});

        firstLine = this._formatTime(firstLine, this._config?.blinkDividers);
        secondLine = this._formatTime(secondLine);

        if (firstLine !== this._firstLine)
            this._firstLine = firstLine;
        if (secondLine !== this._secondLine)
            this._secondLine = secondLine;
    }

    public disconnectedCallback(): void {
        this._stopInterval();
        super.disconnectedCallback();
    }

    protected render(): TemplateResult | void {
        return html`
          <ha-card>
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
            font-family: 'digital-7', sans-serif;
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
          }
          .line .placeholder {
            display: inline-block;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 50;
            opacity: 0.1;
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
