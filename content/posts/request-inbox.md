---
title: "Request Inbox"
date: 2025-05-21T21:49:34+02:00
draft: false
tags: ["side project", "web application"]
---

## Request Inbox

Hace algún tiempo creé un pequeño proyecto para visualizar callbacks y peticiones HTTP.
Lo llamé [Request Inbox](https://request-inbox.com/).

## Objetivo

Comencé a trabajar en este proyecto con el objetivo de reemplazar webhookinbox.com, que se estaba utilizando en el proyecto en el que acababa de empezar a trabajar.
Webhookinbox.com presentaba un comportamiento bastante errático, además de ser muy inseguro. Entre otras cosas, las URLs eran públicas y HTTPS brillaba por su ausencia.

Con la finalidad de crear una aplicación más segura y fiable, desarrollé [Request Inbox](https://request-inbox.com/) y justo hoy he decidido publicar el [repositorio](https://github.com/jesusnoseq/request-inbox).

## Overview

El repositorio es básicamente un monorepo que contiene todo el proyecto: frontend, backend, despliegue y las "pipelines".
También incluye un docker-compose para poder usarlo en local. En este caso, utiliza una base de datos embebida en vez de DynamoDB.

La parte de backend está hecha con Gin (Golang) y el frontend con React.
Es mi primera aplicación con React, y para desarrollarla me ayudé de [V0.dev](https://v0.dev/).

## Uso

Para empezar a usarlo, simplemente pulsa en el botón "create new inbox" y tendrás disponible un endpoint al que enviar y registrar peticiones HTTP.

![request inbox home page](/static/images/request-inbox-home.png)

Una vez creado el "inbox", verás qué endpoint tienes disponible.
Las peticiones al endpoint indicado se registrarán en la aplicación.
En esta página puedes habilitar la actualización automática de peticiones y editar la respuesta.

![request inbox inbox page](/static/images/request-inbox-inbox.png)

Puedes hacer, por ejemplo, lo siguiente:

![request inbox inbox editing](/static/images/request-inbox-inbox-editing.png)

Y si accedes a la URL que se indica, la aplicación registrará la petición y enviará la respuesta.

![request inbox home](/static/images/request-inbox-request-receive.png)

Una vez recibida la request, podrás inspeccionarla cómodamente.

## Features

Además de la funcionalidad principal, podrás registrarte con GitHub para tener inbox privados y un listado de tus propios inbox.

También permite respuestas dinámicas usando la sintaxis de templates de Golang, con algunas funciones extra.
En la [documentación](https://request-inbox.com/docs) puedes encontrar ejemplos.

## Futuro

Actualmente estoy desarrollando otras ideas y [Request Inbox](https://request-inbox.com/) lo mantengo funcionando.

No descarto seguir evolucionando la aplicación en el futuro según las necesidades.

Si tienes alguna sugerencia o idea, puedes abrir una [issue en GitHub](https://github.com/jesusnoseq/request-inbox/issues). Seguro que me hará ilusión leerla.

Espero que la aplicación te sea útil 🤗
