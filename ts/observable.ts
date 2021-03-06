
//declare const riot: typeof import('./riot_types');
//@ts-ignore
import * as riot from './libs/riot.es6.js'
import { Observable as RiotObservable, ObservableCallback } from './riot_types'

const LOG_EVENTS = false;
const DEBUG_FILTER_BLACKLIST = ['stats_changed', 'stats_display_changed'];

export class Observable implements RiotObservable {
	private readonly asObservable;
	private readonly asOriginal;
	constructor() {
		// Backup own functions (these will get overwritten by riot.observable(this)
		this.asOriginal = {
			on: this.on,
			one: this.one,
			off: this.off,
			trigger: this.trigger
		};

		//this.internalObservable = riot.observable(this);
		riot.observable(this);
		this.asObservable = {
			on: this.on,
			one: this.one,
			off: this.off,
			trigger: this.trigger
		}

		// re-install own observable wrappers
		// old ones have been overwritten by riot.observable(this)
		
		this.on = this.asOriginal.on;
		this.one = this.asOriginal.one;
		this.off = this.asOriginal.off;
		this.trigger = this.asOriginal.trigger;
	}

	// There is no inheritable version of `observable()`.
	on(event: string, callback: ObservableCallback): this { // look into super.on(...)
		if(LOG_EVENTS && !DEBUG_FILTER_BLACKLIST.some(v => event == v))
			console.log(`[DEBUG] registering event handler on ${this.constructor.name}: ${event}`);
		return this.asObservable.on(event, callback);
	}
	// Poison event handler since nothing uses it
	one(event: never): this;
	one(event: string, callback?: ObservableCallback): this {
		return this.asObservable.one(event, callback);
	}
	/** Deregister all event handlers */
	off(event: "*"): this;
	/** Register an event handler for `event` */
	off(event: string, callback: ObservableCallback): this;
	off(event: string, callback?: ObservableCallback): this {
		return this.asObservable.off(event, callback);
	}
	trigger(event: string, ...args: any[]): this {
		if(LOG_EVENTS && !DEBUG_FILTER_BLACKLIST.some(v => event == v))
			console.log(`[DEBUG] event triggered ${this.constructor.name}: ${event}(${args.map(v => v.toString()).join()})`);
		return this.asObservable.trigger(event, ...args);
	}
}
