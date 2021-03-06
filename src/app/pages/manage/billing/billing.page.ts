import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import { StripeService, Elements, Element as StripeElement, ElementsOptions } from "ngx-stripe";
import { FormGroup, FormBuilder, Validators } from "@angular/forms";
import {AlertController, ModalController, Platform} from "@ionic/angular";
import {UserData} from "../../../services/user.service";
import {PaymentService} from "../../../services/payment.service";
import {Churches} from "../../../services/church.service";
import {Router} from "@angular/router";
import {Resource} from "../../../services/resource.service";
import {CacheService} from 'ionic-cache';

@Component({
  selector: 'app-billing',
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss'],
  encapsulation: ViewEncapsulation.None
})
export class BillingPage implements OnInit, OnDestroy {

    @Input() modalPage: any;
    elements: Elements;
    card: StripeElement;
    // optional parameters
    elementsOptions: ElementsOptions = {
        locale: 'en'
    };
    billingForm: FormGroup;
    refreshNeeded = false;
    numberOfActiveUsers: any;
    sources: any;
    invoices = [];
    endOfInvoices = false;
    stripeElementName = 'card-element-billing';
    updatePayment = false;
    ionSpinner = false;
    stripeCustomer: any;
    resource: any;
    subscriptions: any = {};

  constructor(
      private cache: CacheService,
      private router: Router,
      public platform: Platform,
      private stripeService: StripeService,
      private formBuilder: FormBuilder,
      public modalCtrl: ModalController,
      private alertCtrl: AlertController,
      public resourceService: Resource,
      private paymentService: PaymentService,
      public churchService: Churches,
      public userData: UserData,
  ) { }

    ngOnInit() {
        this.billingForm = this.formBuilder.group({
            name: ['', [Validators.required]],
            email: ['', [Validators.required]],
            line1: ['', [Validators.required]],
            line2: [''],
            city: ['', [Validators.required]],
            state: ['', [Validators.required]],
            postal_code: ['', [Validators.required]],
            country: ['', [Validators.required]],
        });
        let loadResource = this.resourceService.load('en-US', "Restvo Plans");
        let resource = this.cache.loadFromDelayedObservable('loadResource: Restvo Plans', loadResource, 'resource', 3600, 'none');
        resource.subscribe(result => {
            this.resource = result[0];
        }, async (err) => {
            let networkAlert = await await this.alertCtrl.create({
                header: 'No Internet Connection',
                message: 'Please check your internet connection.',
                buttons: ['Dismiss'],
                cssClass: 'level-15'
            });
            await networkAlert.present();
        });
        this.invoices = [];
        this.preparePage();
        this.subscriptions['refreshUserStatus'] = this.userData.refreshUserStatus$.subscribe(this.refreshHandler);
    }

    ionViewDidEnter() {
        this.stripeElementName = 'card-element-billing' + (this.modalPage ? '-modal' : '');
    }

    refreshHandler = async (data) => {
        if (data && data.type === 'load community ready') {
          this.updatePayment = false;
          this.invoices = [];
          this.preparePage();
        }
    };

    async preparePage() {
        if (this.churchService.currentManagedCommunity) {
            this.stripeCustomer = await this.paymentService.loadCustomer(this.userData.user.churches[this.userData.currentCommunityIndex]._id);
            this.churchService.numberOfActiveUsers = await this.churchService.getAppUserUsage(this.churchService.currentManagedCommunity._id);
            if (this.stripeCustomer) {
                this.loadBillingInfo();
                this.listInvoices(null);
            }
        }
    }

    prepareBillingElement() {
        this.stripeService.elements(this.elementsOptions)
            .subscribe(elements => {
                this.elements = elements;
                // Only mount the element the first time
                if (!this.card) {
                    this.card = this.elements.create('card', {
                        style: {
                            base: {
                                iconColor: '#666EE8',
                                color: '#31325F',
                                fontWeight: 300,
                                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                                fontSize: '18px',
                                '::placeholder': {
                                    color: '#CFD7E0'
                                }
                            }
                        }
                    });
                    this.card.mount('#' + this.stripeElementName);
                } else {
                    this.card.mount('#' + this.stripeElementName);
                }
            });
    }

  async loadBillingInfo() {
      this.sources = await this.paymentService.loadBillingInfo(this.churchService.currentManagedCommunity._id);
  }

  async updatePaymentMethod() {
        if (!this.platform.is('cordova')) {
            this.updatePayment = true;
            this.prepareBillingElement();
        } else {
            const alert = await this.alertCtrl.create({
                header: 'Opening the In-App Browser',
                subHeader: 'To update the billing information, you will be redirected to app.restvo.com.',
                buttons: [{ text: 'Ok',
                    handler: () => {
                        const navTransition = alert.dismiss();
                        navTransition.then(async () => {
                            window.open('https://app.restvo.com/register', "_blank");
                        });
                    }},
                    { text: 'Cancel' }],
                cssClass: 'level-15'
            });
            await alert.present();
        }
  }

  async submitBillingMethod() {
        try {
            this.ionSpinner = true;
            const owner = this.billingForm.value;
            owner.address = { line1: owner.line1, line2: owner.line2, city: owner.city, state: owner.state, postal_code: owner.postal_code, country: owner.country };
            delete owner.line1;
            delete owner.line2;
            delete owner.city;
            delete owner.state;
            delete owner.postal_code;
            delete owner.country;
            this.stripeService.createSource(this.card, {
                type: 'card',
                currency: 'usd',
                owner: owner,
            }).subscribe(async (result) => {
                if (result.source) {
                    const updateResult = await this.paymentService.updateBillingMethod(this.churchService.currentManagedCommunity._id, result.source);
                    this.ionSpinner = false;
                    if (updateResult === 'success') {
                        this.loadBillingInfo();
                        this.card.clear();
                        this.billingForm.reset();
                        const alert = await this.alertCtrl.create({
                            header: 'Success',
                            subHeader: 'Your payment method is updated.',
                            buttons: [{ text: 'Ok' }],
                            cssClass: 'level-15'
                        });
                        await alert.present();
                    } else {
                        const alert = await this.alertCtrl.create({
                            header: 'Something Went Wrong',
                            subHeader: 'We cannot process your request at this time. Please try again later.',
                            buttons: [{ text: 'Ok' }],
                            cssClass: 'level-15'
                        });
                        await alert.present();
                    }
                } else if (result.error) {
                    this.ionSpinner = false;
                    // Error creating the source
                    console.log(result.error.message);
                    const alert = await this.alertCtrl.create({
                        header: 'Something Went Wrong',
                        subHeader: 'We cannot process your request at this time.',
                        message: result.error.message,
                        buttons: [{ text: 'Ok' }],
                        cssClass: 'level-15'
                    });
                    await alert.present();
                }
            });
        } catch (err) {
            this.ionSpinner = false;
            const alert = await this.alertCtrl.create({
                header: 'Something Went Wrong',
                subHeader: 'We cannot process your request at this time. Please try again later.',
                buttons: [{ text: 'Ok' }],
                cssClass: 'level-15'
            });
            await alert.present();
        }
  }

    async listInvoices(direction) {
        let query = '';
        if (direction === 'previous'){
            query += "?ending_before=" + this.invoices[0].id;
        }
        if (direction === 'next'){
            query += "?starting_after=" + this.invoices[this.invoices.length-1].id;
        }
        const invoices: any = await this.paymentService.listInvoices(this.churchService.currentManagedCommunity._id, query);
        invoices.forEach((invoice)=>{
            this.invoices.push(invoice);
        });
    }

    closeModal() {
        this.modalCtrl.dismiss(this.refreshNeeded);
    }

    ngOnDestroy() {
        /*if (this.card) {
            this.card.unmount();
        }*/
        this.subscriptions['refreshUserStatus'].unsubscribe(this.refreshHandler);
    }
}
