---
title: "Request Inbox"
date: 2025-05-06T12:00:00+00:00
draft: false
tags: ["side project", "web application"]
categories: ["blog"]
---

## Request Inbox

Some time ago, I created a small project to visualize callbacks and HTTP requests.
I called it [Request Inbox](https://request-inbox.com/).

## Objective

I started working on this project with the goal of replacing webhookinbox.com, which was being used in the project I had just joined.
Webhookinbox.com behaved quite erratically and was also very insecure. Among other things, all the URLs were public and there was no HTTPS.

To create a more secure and reliable application, I developed [Request Inbox](https://request-inbox.com/), and today I decided to publish the [repository](https://github.com/jesusnoseq/request-inbox).

## Overview

The repository is basically a monorepo that contains the entire project: frontend, backend, deployment, and pipelines.
It also includes a docker-compose file to run it locally. In this case, it uses an embedded database instead of DynamoDB.

The backend is built with Gin (Golang) and the frontend with React.
This is my first application with React, and I used [V0.dev](https://v0.dev/) to help with the development.

## Usage

To get started, simply click the "create new inbox" button and you will have an endpoint available to send and log HTTP requests.

![request inbox home page](/images/request-inbox-home.png)

Once the inbox is created, you will see which endpoint is available.
Requests sent to the indicated endpoint will be logged in the application.
On this page, you can enable automatic request updates and edit the response.

![request inbox inbox page](/images/request-inbox-inbox.png)

For example, you can do the following:

![request inbox inbox editing](/images/request-inbox-inbox-editing.png)

And if you access the indicated URL, the application will log the request and send the response.

![request inbox home](/images/request-inbox-request-receive.png)

Once the request is received, you can conveniently inspect it.

## Features

In addition to the main functionality, you can sign in with GitHub to have private inboxes and a list of your own inboxes.

It also allows dynamic responses using Golang's template syntax, with some extra functions.
You can find examples in the [documentation](https://request-inbox.com/docs).

## Future

I am currently working on other ideas, but I keep [Request Inbox](https://request-inbox.com/) running.

I do not rule out continuing to improve the application in the future as needs arise.

If you have any suggestions or ideas, you can open an [issue on GitHub](https://github.com/jesusnoseq/request-inbox/issues). I would be happy to read it.

I hope you find the application useful 🤗
